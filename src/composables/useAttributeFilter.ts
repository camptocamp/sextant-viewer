import { computed, onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMapStore } from '@/stores/map.store'
import {
  fetchCount,
  fetchExtent,
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
const EXTENT_ERROR = 'Impossible de calculer l’étendue de la sélection.'

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
  const loadFailed = ref(false)
  const zooming = ref(false)
  const zoomFailed = ref(false)
  const error = computed(() => {
    if (loadFailed.value) return LOAD_ERROR
    return zoomFailed.value ? EXTENT_ERROR : null
  })

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
      loadFailed.value = false
      count.value = total
      if (grandTotal !== null) totalCount.value = grandTotal
      fieldValues.value = Object.fromEntries(results.map((result) => [result.esField, result]))
    } catch (e) {
      if (signal.aborted || id !== requestId) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      loadFailed.value = true
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
    loadFailed.value = false
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

  // Separate from `controller`: zooming must not abort an in-flight count refresh.
  let zoomController: AbortController | null = null

  function cancelZoom() {
    zoomController?.abort()
    zoomController = null
    zooming.value = false
    zoomFailed.value = false
  }

  async function zoomToSelection() {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    cancelZoom()
    const current = new AbortController()
    zoomController = current
    zooming.value = true
    try {
      const filters = toFilterState(activeFilters.value)
      const extent = await fetchExtent(dataIndex, filters, current.signal)
      if (current.signal.aborted) return
      if (extent) {
        mapStore.setView({ extent })
      } else {
        zoomFailed.value = true
      }
    } catch (e) {
      if (current.signal.aborted) return
      console.error("Erreur lors du calcul de l'étendue de la sélection:", e)
      zoomFailed.value = true
    } finally {
      if (zoomController === current) {
        zoomController = null
        zooming.value = false
      }
    }
  }

  // A zoom started on another layer or selection must neither move the map nor report its failure.
  watch([() => toValue(layer)?.id, () => JSON.stringify(activeFilters.value)], cancelZoom)
  onScopeDispose(cancelZoom)

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
    zooming: readonly(zooming),
    error,
    activeFilters,
    hasActiveFilters,
    toggleValue,
    resetFilters,
    zoomToSelection,
  }
}
