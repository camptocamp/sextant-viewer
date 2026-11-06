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

interface ColumnState {
  // The values list is capped, so a search must query the index rather than filter the list.
  term: string
  values?: DistinctFieldValues
  searching: boolean
  failed: boolean
}

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
  const columns = ref<Record<string, ColumnState>>({})
  const count = ref<number | null>(null)
  const totalCount = ref<number | null>(null)
  const loading = ref(false)
  const countsFailed = ref(false)

  const fieldValues = computed<Record<string, DistinctFieldValues>>(() =>
    Object.fromEntries(
      Object.entries(columns.value).flatMap(([esField, column]) =>
        column.values ? [[esField, column.values]] : [],
      ),
    ),
  )
  const searching = computed<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.entries(columns.value).map(([esField, column]) => [esField, column.searching]),
    ),
  )
  const zooming = ref(false)
  const zoomFailed = ref(false)
  const error = computed(() => {
    if (countsFailed.value || Object.values(columns.value).some((column) => column.failed)) {
      return LOAD_ERROR
    }
    return zoomFailed.value ? EXTENT_ERROR : null
  })

  const activeFilters = computed<ActiveFilters>(() => activeFiltersOf(toValue(layer)))
  const hasActiveFilters = computed(() =>
    Object.values(activeFilters.value).some((values) => values.length > 0),
  )

  const columnOf = (esField: string): ColumnState =>
    columns.value[esField] ?? { term: '', searching: false, failed: false }

  function patchColumn(esField: string, patch: Partial<ColumnState>) {
    columns.value = { ...columns.value, [esField]: { ...columnOf(esField), ...patch } }
  }

  // Kept out of `columns`: a reactive proxy breaks the native `abort()`.
  const columnControllers = new Map<string, AbortController>()
  let countsController: AbortController | null = null

  /**
   * (Re)load one column's faceted values with its current term, superseding its previous request
   * whether a refresh or a search started it. Counts exclude the column's own selection so its
   * other values stay visible.
   */
  async function fetchColumn(dataIndex: GeoNetworkIndexConnection, field: IndexField) {
    const { esField } = field
    columnControllers.get(esField)?.abort()
    const controller = new AbortController()
    columnControllers.set(esField, controller)
    patchColumn(esField, { searching: true })

    try {
      const values = await fetchFieldValues(
        dataIndex,
        field,
        toFilterState(activeFilters.value, esField),
        { signal: controller.signal, search: columnOf(esField).term },
      )
      if (controller.signal.aborted) return
      patchColumn(esField, { values, failed: false })
    } catch (e) {
      if (controller.signal.aborted) return
      console.error(`Erreur lors du chargement des valeurs de ${esField}:`, e)
      patchColumn(esField, { failed: true })
    } finally {
      if (columnControllers.get(esField) === controller) {
        columnControllers.delete(esField)
        patchColumn(esField, { searching: false })
      }
    }
  }

  async function fetchCounts(
    dataIndex: GeoNetworkIndexConnection,
    signal: AbortSignal,
    withTotal: boolean,
  ) {
    try {
      const [total, grandTotal] = await Promise.all([
        fetchCount(dataIndex, toFilterState(activeFilters.value), signal),
        // Refetch the grand total whenever it is still unknown, so a failed initial load recovers.
        withTotal || totalCount.value === null
          ? fetchCount(dataIndex, [], signal)
          : Promise.resolve<number | null>(null),
      ])
      if (signal.aborted) return
      countsFailed.value = false
      count.value = total
      if (grandTotal !== null) totalCount.value = grandTotal
    } catch (e) {
      if (signal.aborted) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      countsFailed.value = true
    }
  }

  /**
   * Reload every column and the counts. The refresh that isn't superseded ends `loading`, so a
   * selection change during the initial load takes over ending it.
   */
  async function refresh(withTotal = false) {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    countsController?.abort()
    countsController = new AbortController()
    const { signal } = countsController
    await Promise.all([
      ...fields.value.map((field) => fetchColumn(dataIndex, field)),
      fetchCounts(dataIndex, signal, withTotal),
    ])
    if (!signal.aborted) loading.value = false
  }

  /** Re-query one column's values for `term`, leaving the other columns untouched. */
  async function searchValues(esField: string, term: string) {
    const dataIndex = dataIndexOf(toValue(layer))
    const field = fields.value.find((f) => f.esField === esField)
    if (!dataIndex || !field) return
    patchColumn(esField, { term })
    await fetchColumn(dataIndex, field)
  }

  function cancelAll() {
    countsController?.abort()
    columnControllers.forEach((c) => c.abort())
    columnControllers.clear()
  }

  async function load() {
    cancelAll()
    columns.value = {}
    if (!dataIndexOf(toValue(layer))) {
      count.value = null
      totalCount.value = null
      return
    }
    loading.value = true
    countsFailed.value = false
    await refresh(true)
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

  // Independent of `requestId`: zooming must not abort an in-flight count refresh.
  async function zoomToSelection() {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    zooming.value = true
    zoomFailed.value = false
    try {
      const extent = await fetchExtent(dataIndex, toFilterState(activeFilters.value))
      if (extent) {
        mapStore.setView({ extent })
      } else {
        zoomFailed.value = true
      }
    } catch (e) {
      console.error("Erreur lors du calcul de l'étendue de la sélection:", e)
      zoomFailed.value = true
    } finally {
      zooming.value = false
    }
  }

  // Reload on layer change; on a selection change, only refresh the faceted counts. Watching
  // serialized values (not the layer object) keeps unrelated layer updates — opacity, visibility —
  // from superseding an in-flight load.
  watch([() => toValue(layer)?.id, () => JSON.stringify(activeFilters.value)], ([id], [oldId]) => {
    if (id !== oldId) return load()
    return refresh()
  })
  load()

  onScopeDispose(cancelAll)

  return {
    fields,
    fieldValues,
    count: readonly(count),
    totalCount: readonly(totalCount),
    loading: readonly(loading),
    error,
    searching,
    zooming: readonly(zooming),
    activeFilters,
    hasActiveFilters,
    toggleValue,
    resetFilters,
    searchValues,
    zoomToSelection,
  }
}
