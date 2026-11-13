import { computed, onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Extent } from '@geospatial-sdk/core'
import { useMapStore } from '@/stores/map.store'
import {
  fetchCount,
  fetchDateBounds,
  fetchExtent,
  fetchFieldValues,
  fetchTreeValues,
  type DateBounds,
  type DistinctFieldValues,
  type IndexField,
} from '@/utils/geonetwork-index'
import { ancestorPaths, isWithin } from '@/utils/geonetwork-index/pathTree'
import { isLayerDataIndexed, type MapLayer } from '@/utils/layer.utils'
import type { GeoNetworkIndexConnection, WmsFilterState } from '@/types/wms.types'

/** Selected days of a date-range column, `YYYY-MM-DD`, inclusive. */
export interface DateRangeSelection {
  from: string
  to: string
}

/** UI-friendly view of the active selections, keyed by column (`esField`). */
interface ActiveFilters {
  /** Selected values of value-list columns, selected paths of tree columns. */
  values: Record<string, string[]>
  dateRanges: Record<string, DateRangeSelection>
  /** Geographic area, EPSG:4326. */
  bbox?: Extent
}

const NO_FILTERS: ActiveFilters = { values: {}, dateRanges: {} }

const LOAD_ERROR =
  'Impossible de charger les valeurs depuis ElasticSearch. Vérifiez la connexion à l’index.'
const EXTENT_ERROR = 'Impossible de calculer l’étendue de la sélection.'

function dataIndexOf(layer: MapLayer): GeoNetworkIndexConnection | undefined {
  if (!isLayerDataIndexed(layer)) return undefined
  return layer.extras?.dataIndex
}

function activeFiltersOfLayer(layer: MapLayer): ActiveFilters {
  const state = (isLayerDataIndexed(layer) && layer.extras?.filter) || []
  const active: ActiveFilters = { values: {}, dateRanges: {} }
  for (const filter of state) {
    if (filter.kind === 'dateRange') {
      active.dateRanges[filter.attributeName] = { from: filter.from, to: filter.to }
    } else if (filter.kind === 'bbox') {
      active.bbox = filter.extent
    } else if (filter.kind === undefined) {
      active.values[filter.attributeName] = filter.values
    }
  }
  return active
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
  const geometryName = computed(() => dataIndexOf(toValue(layer))?.geometryName)
  const fieldValues = ref<Record<string, DistinctFieldValues>>({})
  const dateBounds = ref<Record<string, DateBounds | null>>({})
  const count = ref<number | null>(null)
  const totalCount = ref<number | null>(null)
  const loading = ref(false)
  const loadFailed = ref(false)
  // Separate from `loadFailed`: bounds load only with the layer, so a later successful count
  // refresh must not hide their failure.
  const boundsFailed = ref(false)
  // Per-column search term: the values list is capped, so a search must query the index.
  const searchTerms = ref<Record<string, string>>({})
  // Expanded paths of each tree column: its levels load as they are expanded.
  const expandedPaths = ref<Record<string, string[]>>({})
  const searching = ref<Record<string, boolean>>({})
  // Tracked per column so a successful search only clears its own failure.
  const searchFailed = ref<Record<string, boolean>>({})
  const zooming = ref(false)
  const zoomFailed = ref(false)
  const error = computed(() => {
    if (loadFailed.value || boundsFailed.value || Object.values(searchFailed.value).some(Boolean)) {
      return LOAD_ERROR
    }
    return zoomFailed.value ? EXTENT_ERROR : null
  })

  const activeFilters = computed<ActiveFilters>(() => activeFiltersOfLayer(toValue(layer)))
  const hasActiveFilters = computed(() => {
    const { values, dateRanges, bbox } = activeFilters.value
    return (
      Object.values(values).some((selected) => selected.length > 0) ||
      Object.keys(dateRanges).length > 0 ||
      !!bbox
    )
  })

  /**
   * Active selections → filter state, optionally excluding one column (for faceting: a column's
   * counts ignore its own selection). The bbox and date ranges are never excluded.
   */
  function toFilterState(active: ActiveFilters, exclude?: string): WmsFilterState {
    const state: WmsFilterState = []
    for (const field of fields.value) {
      if (field.esField === exclude) continue
      if (field.type === 'dateRange') {
        const range = active.dateRanges[field.esField]
        if (!range) continue
        const { minField, maxField } = field
        state.push({
          kind: 'dateRange',
          attributeName: field.esField,
          minField,
          maxField,
          ...range,
        })
        continue
      }
      const values = active.values[field.esField] ?? []
      if (values.length === 0) continue
      state.push(
        field.type === 'tree'
          ? {
              attributeName: field.esField,
              matchType: 'tree',
              values,
              ...(field.tokenSeparator && { tokenSeparator: field.tokenSeparator }),
            }
          : { attributeName: field.esField, matchType: field.matchType, values },
      )
    }
    if (active.bbox && geometryName.value) {
      state.push({ kind: 'bbox', geometryName: geometryName.value, extent: active.bbox })
    }
    return state
  }

  /** The index query behind a column's list: a result for an older one must not be shown. */
  const columnQuery = (esField: string) =>
    JSON.stringify([searchTerms.value[esField] ?? '', expandedPaths.value[esField] ?? []])

  /** One column's faceted values, for its current search term (and expanded levels for a tree). */
  function fetchColumn(
    dataIndex: GeoNetworkIndexConnection,
    field: IndexField,
    active: ActiveFilters,
    signal: AbortSignal,
  ): Promise<DistinctFieldValues> | null {
    const filters = toFilterState(active, field.esField)
    const search = searchTerms.value[field.esField]
    switch (field.type) {
      case 'terms':
        return fetchFieldValues(dataIndex, field, filters, signal, search)
      case 'tree': {
        const expanded = expandedPaths.value[field.esField]
        return fetchTreeValues(dataIndex, field, filters, { expanded, search }, signal)
      }
      default:
        return null
    }
  }

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
    const columns = fields.value.flatMap((field) => {
      const request = fetchColumn(dataIndex, field, active, signal)
      return request ? [{ esField: field.esField, query: columnQuery(field.esField), request }] : []
    })
    try {
      const [results, total, grandTotal] = await Promise.all([
        Promise.all(columns.map((column) => column.request)),
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
      // A column searched or expanded again meanwhile keeps its newer result.
      fieldValues.value = Object.fromEntries(
        results.map((result, i) => [
          result.esField,
          columnQuery(result.esField) === columns[i]!.query
            ? result
            : fieldValues.value[result.esField],
        ]),
      )
    } catch (e) {
      if (signal.aborted || id !== requestId) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      loadFailed.value = true
    }
  }

  /** Date bounds of the date-range columns; whole layer, so only loaded with the layer. */
  async function loadDateBounds({ id, signal }: { id: number; signal: AbortSignal }) {
    const dataIndex = dataIndexOf(toValue(layer))
    if (!dataIndex) return
    try {
      const entries = await Promise.all(
        fields.value.flatMap((field) =>
          field.type === 'dateRange'
            ? [fetchDateBounds(dataIndex, field, signal).then((b) => [field.esField, b] as const)]
            : [],
        ),
      )
      if (id === requestId) dateBounds.value = Object.fromEntries(entries)
    } catch (e) {
      if (signal.aborted || id !== requestId) return
      console.error('Erreur lors du chargement des bornes de dates ElasticSearch:', e)
      boundsFailed.value = true
    }
  }

  const columnControllers = new Map<string, AbortController>()

  /** Re-query one column for its current search term and expanded levels, leaving the others. */
  async function requeryColumn(esField: string) {
    const dataIndex = dataIndexOf(toValue(layer))
    const field = fields.value.find((f) => f.esField === esField)
    if (!dataIndex || !field) return

    columnControllers.get(esField)?.abort()
    const columnController = new AbortController()
    columnControllers.set(esField, columnController)
    searching.value = { ...searching.value, [esField]: true }

    try {
      const result = await fetchColumn(
        dataIndex,
        field,
        activeFilters.value,
        columnController.signal,
      )
      if (!result || columnController.signal.aborted) return
      fieldValues.value = { ...fieldValues.value, [esField]: result }
      searchFailed.value = { ...searchFailed.value, [esField]: false }
    } catch (e) {
      if (columnController.signal.aborted) return
      console.error(`Erreur lors du chargement des valeurs de ${esField}:`, e)
      searchFailed.value = { ...searchFailed.value, [esField]: true }
    } finally {
      if (columnControllers.get(esField) === columnController) {
        columnControllers.delete(esField)
        searching.value = { ...searching.value, [esField]: false }
      }
    }
  }

  /** Re-query one column's values for `term`, leaving the other columns untouched. */
  function searchValues(esField: string, term: string) {
    searchTerms.value = { ...searchTerms.value, [esField]: term }
    return requeryColumn(esField)
  }

  /** Set a tree column's expanded paths; newly expanded levels load (collapsing needs nothing). */
  function setExpanded(esField: string, paths: string[]) {
    const previous = new Set(expandedPaths.value[esField] ?? [])
    expandedPaths.value = { ...expandedPaths.value, [esField]: paths }
    // While searching, the matches come with all their ancestors already.
    if (searchTerms.value[esField]) return
    if (paths.some((path) => !previous.has(path))) return requeryColumn(esField)
  }

  /** Cancel in-flight column queries and forget their failures; terms are kept. */
  function resetColumnQueries() {
    columnControllers.forEach((c) => c.abort())
    columnControllers.clear()
    searching.value = {}
    searchFailed.value = {}
  }

  /** Expand the ancestors of the selected tree paths, so a restored selection shows. */
  function expandSelectedPaths(): Record<string, string[]> {
    const expanded: Record<string, string[]> = {}
    for (const field of fields.value) {
      if (field.type !== 'tree') continue
      const selected = activeFilters.value.values[field.esField] ?? []
      expanded[field.esField] = [...new Set(selected.flatMap(ancestorPaths))]
    }
    return expanded
  }

  async function load() {
    resetColumnQueries()
    searchTerms.value = {}
    expandedPaths.value = expandSelectedPaths()
    if (!dataIndexOf(toValue(layer))) {
      fieldValues.value = {}
      dateBounds.value = {}
      count.value = null
      totalCount.value = null
      return
    }
    const req = nextRequest()
    loading.value = true
    loadFailed.value = false
    boundsFailed.value = false
    await Promise.all([refreshValues(req, true), loadDateBounds(req)])
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

  function setValues(esField: string, values: string[]) {
    const active = activeFilters.value
    setActiveFilters({ ...active, values: { ...active.values, [esField]: values } })
  }

  function toggleValue(esField: string, value: string) {
    const selected = new Set(activeFilters.value.values[esField] ?? [])
    if (selected.has(value)) {
      selected.delete(value)
    } else {
      selected.add(value)
    }
    setValues(esField, [...selected])
  }

  /**
   * Toggle a tree path. Selecting it drops its selected descendants, which it already matches (in
   * the index and on the WMS), keeping the WMS filter short.
   */
  function toggleTreePath(esField: string, path: string) {
    const selected = activeFilters.value.values[esField] ?? []
    setValues(
      esField,
      selected.includes(path)
        ? selected.filter((p) => p !== path)
        : [...selected.filter((p) => !isWithin(p, path)), path],
    )
  }

  function setDateRange(esField: string, range: DateRangeSelection | null) {
    const { [esField]: _, ...dateRanges } = activeFilters.value.dateRanges
    setActiveFilters({
      ...activeFilters.value,
      dateRanges: range ? { ...dateRanges, [esField]: range } : dateRanges,
    })
  }

  function setBbox(bbox: Extent | null) {
    setActiveFilters({ ...activeFilters.value, bbox: bbox ?? undefined })
  }

  function resetFilters() {
    setActiveFilters(NO_FILTERS)
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
  // from superseding an in-flight load. A selection change during the load supersedes it, so the
  // load restarts: a mere refresh would neither load the date bounds nor end `loading`.
  watch([() => toValue(layer)?.id, () => JSON.stringify(activeFilters.value)], ([id], [oldId]) => {
    if (id !== oldId || loading.value) return load()
    // A column query started under the old selection would overwrite the refreshed values; the
    // refresh re-runs every column with its current term and expanded levels anyway.
    resetColumnQueries()
    return refreshValues(nextRequest())
  })
  load()

  onScopeDispose(() => {
    controller?.abort()
    resetColumnQueries()
  })

  return {
    fields,
    geometryName,
    fieldValues: readonly(fieldValues),
    dateBounds: readonly(dateBounds),
    count: readonly(count),
    totalCount: readonly(totalCount),
    loading: readonly(loading),
    error,
    searching: readonly(searching),
    searchTerms: readonly(searchTerms),
    expandedPaths: readonly(expandedPaths),
    zooming: readonly(zooming),
    activeFilters,
    hasActiveFilters,
    toggleValue,
    toggleTreePath,
    setDateRange,
    setBbox,
    resetFilters,
    searchValues,
    setExpanded,
    zoomToSelection,
  }
}
