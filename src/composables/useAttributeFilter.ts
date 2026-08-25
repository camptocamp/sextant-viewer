import { computed, onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMapStore } from '@/stores/map.store'
import {
  fetchCount,
  fetchFieldValues,
  type DistinctFieldValues,
  type IndexField,
} from '@/utils/geonetwork-index'
import { isLayerDataIndexed, type MapLayer } from '@/utils/layer.utils'
import { activeFiltersOf } from '@/utils/wms.utils'
import type { GeoNetworkIndexConnection, WmsFilterState } from '@/types/wms.types'

/** UI-friendly view of the active selections: selected values keyed by column (`esField`). */
type ActiveFilters = Record<string, string[]>

const LOAD_ERROR =
  'Impossible de charger les valeurs depuis ElasticSearch. Vérifiez la connexion à l’index.'

function dataIndexOf(layer: MapLayer): GeoNetworkIndexConnection | undefined {
  if (!isLayerDataIndexed(layer)) return undefined
  return layer.extras?.dataIndex
}

/** Active selections → an ES query filter, optionally excluding one column (for faceting). */
function toFilterState(active: ActiveFilters, exclude?: string): WmsFilterState {
  return Object.entries(active)
    .filter(([esField, values]) => values.length > 0 && esField !== exclude)
    .map(([attributeName, values]) => ({ attributeName, matchType: 'equals' as const, values }))
}

/**
 * Drives the attribute-filter UI for a WMS layer whose ES index has been resolved (detection stored
 * `extras.dataIndex`): renders the discovered columns, loads each column's faceted values/counts,
 * and persists the user's selections on the layer's `extras.filter` (which re-renders the WMS layer
 * with the OGC FILTER).
 */
export function useAttributeFilter(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const fields = computed<IndexField[]>(() => dataIndexOf(toValue(layer))?.fields ?? [])
  const fieldValues = ref<Record<string, DistinctFieldValues>>({})
  const count = ref<number | null>(null)
  const totalCount = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeFilters = computed<ActiveFilters>(() => activeFiltersOf(toValue(layer)))
  const hasActiveFilters = computed(() =>
    Object.values(activeFilters.value).some((values) => values.length > 0),
  )

  // Each new request supersedes the previous one: the previous is aborted, and async writes are
  // gated on `id === requestId` so a stale request can neither clobber newer state nor wipe a fresh
  // error.
  let requestId = 0
  let controller: AbortController | null = null

  function nextRequest(): { id: number; signal: AbortSignal } {
    controller?.abort()
    controller = new AbortController()
    return { id: ++requestId, signal: controller.signal }
  }

  /**
   * Refresh faceted value counts: each column's counts exclude its own selection so its other
   * values stay visible. Sole owner of `count`/`totalCount`/`fieldValues` so the paths never race.
   */
  async function refreshValues(
    { id, signal }: { id: number; signal: AbortSignal },
    withTotal = false,
  ) {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    const active = activeFilters.value
    try {
      const [results, total, grandTotal] = await Promise.all([
        Promise.all(
          fields.value.map((field) =>
            fetchFieldValues(dataIndex, field, toFilterState(active, field.esField), signal),
          ),
        ),
        fetchCount(dataIndex, toFilterState(active), signal),
        // Refetch the grand total whenever it is still unknown, so a failed initial load recovers.
        withTotal || totalCount.value === null
          ? fetchCount(dataIndex, [], signal)
          : Promise.resolve<number | null>(null),
      ])
      if (id !== requestId) return
      error.value = null
      count.value = total
      if (grandTotal !== null) totalCount.value = grandTotal
      fieldValues.value = Object.fromEntries(results.map((result) => [result.esField, result]))
    } catch (e) {
      if (signal.aborted || id !== requestId) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      error.value = LOAD_ERROR
    }
  }

  async function load() {
    if (!dataIndexOf(toValue(layer))) {
      fieldValues.value = {}
      count.value = null
      totalCount.value = null
      return
    }
    const req = nextRequest()
    loading.value = true
    error.value = null
    await refreshValues(req, true)
    if (req.id === requestId) loading.value = false
  }

  function setActiveFilters(active: ActiveFilters) {
    const currentLayer = toValue(layer)
    if (!isLayerDataIndexed(currentLayer)) return
    mapStore.updateLayer(currentLayer, {
      extras: { ...currentLayer.extras, filter: toFilterState(active) },
      version: (currentLayer.version || 0) + 1,
    })
  }

  function toggleValue(esField: string, value: string) {
    const selected = new Set(activeFilters.value[esField] ?? [])
    if (selected.has(value)) {
      selected.delete(value)
    } else {
      selected.add(value)
    }
    setActiveFilters({ ...activeFilters.value, [esField]: [...selected] })
  }

  function resetFilters() {
    setActiveFilters({})
  }

  // Reload on layer change; on a selection change, only refresh the faceted counts. Watching
  // serialized values (not the layer object) keeps unrelated layer updates — opacity, visibility —
  // from superseding an in-flight load.
  watch([() => toValue(layer)?.id, () => JSON.stringify(activeFilters.value)], ([id], [oldId]) =>
    id === oldId ? refreshValues(nextRequest()) : load(),
  )
  load()

  // Cancel any in-flight request when the panel is torn down.
  onScopeDispose(() => controller?.abort())

  return {
    fields,
    fieldValues: readonly(fieldValues),
    count: readonly(count),
    totalCount: readonly(totalCount),
    loading: readonly(loading),
    error: readonly(error),
    activeFilters,
    hasActiveFilters,
    toggleValue,
    resetFilters,
  }
}
