import { computed, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMapStore } from '@/stores/map.store'
import {
  fetchCount,
  fetchFieldValues,
  type DistinctFieldValues,
  type IndexField,
} from '@/utils/geonetwork-index'
import { isLayerDataIndexed, type MapLayer } from '@/utils/layer.utils'
import type {
  ExtendedMapLayerWms,
  GeoNetworkIndexConnection,
  WmsFilterState,
} from '@/types/wms.types'

/** UI-friendly view of the active selections: selected values keyed by column (`esField`). */
type ActiveFilters = Record<string, string[]>

const LOAD_ERROR =
  'Impossible de charger les valeurs depuis ElasticSearch. Vérifiez la connexion à l’index.'

function dataIndexOf(layer: MapLayer): GeoNetworkIndexConnection | undefined {
  if (!isLayerDataIndexed(layer)) return undefined
  return (layer.extras as ExtendedMapLayerWms['extras'])?.dataIndex
}

function filterStateOf(layer: MapLayer): WmsFilterState {
  return (layer.extras as ExtendedMapLayerWms['extras'])?.filter ?? []
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

  const activeFilters = computed<ActiveFilters>(() => {
    const out: ActiveFilters = {}
    for (const { attributeName, values } of filterStateOf(toValue(layer)))
      out[attributeName] = values
    return out
  })
  const hasActiveFilters = computed(() =>
    Object.values(activeFilters.value).some((values) => values.length > 0),
  )

  // Each new request supersedes the previous one: async writes are gated on `id === requestId` so a
  // stale in-flight request can neither clobber newer state nor wipe a fresh error.
  let requestId = 0

  /**
   * Refresh faceted value counts: each column's counts exclude its own selection so its other
   * values stay visible. Sole owner of `count`/`totalCount`/`fieldValues` so the paths never race.
   */
  async function refreshValues(id: number, withTotal = false) {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    const active = activeFilters.value
    try {
      const [results, total, grandTotal] = await Promise.all([
        Promise.all(
          fields.value.map((field) =>
            fetchFieldValues(dataIndex, field, toFilterState(active, field.esField)),
          ),
        ),
        fetchCount(dataIndex, toFilterState(active)),
        withTotal ? fetchCount(dataIndex, []) : Promise.resolve<number | null>(null),
      ])
      if (id !== requestId) return
      error.value = null
      count.value = total
      if (grandTotal !== null) totalCount.value = grandTotal
      fieldValues.value = Object.fromEntries(results.map((result) => [result.esField, result]))
    } catch (e) {
      if (id !== requestId) return
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
    const id = ++requestId
    loading.value = true
    error.value = null
    await refreshValues(id, true)
    if (id === requestId) loading.value = false
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

  // Reload on layer change; on a selection change, only refresh the faceted counts.
  watch(() => toValue(layer)?.id, load, { immediate: true })
  watch(activeFilters, () => refreshValues(++requestId))

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
