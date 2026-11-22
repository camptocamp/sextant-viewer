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

interface ColumnState {
  // The values list is capped, so a search must query the index rather than filter the list.
  term: string
  /** Expanded paths of a tree column: its levels load as they are expanded. */
  expanded: string[]
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
 * The geometry property the area filter names. Detection reads it from the WFS; when that fails,
 * a persisted area still names it, and dropping that area would leave it on the WMS only.
 */
function geometryNameOf(layer: MapLayer): string | undefined {
  if (!isLayerDataIndexed(layer)) return undefined
  const persisted = layer.extras?.filter?.find((filter) => filter.kind === 'bbox')
  return layer.extras?.dataIndex?.geometryName ?? persisted?.geometryName
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
  const geometryName = computed(() => geometryNameOf(toValue(layer)))
  const columns = ref<Record<string, ColumnState>>({})
  const dateBounds = ref<Record<string, DateBounds | null>>({})
  const count = ref<number | null>(null)
  const totalCount = ref<number | null>(null)
  const loading = ref(false)
  const countsFailed = ref(false)
  // Separate from `countsFailed`: bounds load only with the layer, so a later successful count
  // refresh must not hide their failure.
  const boundsFailed = ref(false)

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
  const expandedPaths = computed<Record<string, string[]>>(() =>
    Object.fromEntries(
      fields.value.flatMap((field) =>
        field.type === 'tree' ? [[field.esField, columnOf(field.esField).expanded]] : [],
      ),
    ),
  )
  const zooming = ref(false)
  const zoomFailed = ref(false)
  const loadError = computed(() =>
    countsFailed.value ||
    boundsFailed.value ||
    Object.values(columns.value).some((column) => column.failed)
      ? LOAD_ERROR
      : null,
  )
  const zoomError = computed(() => (zoomFailed.value ? EXTENT_ERROR : null))

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

  const newColumn = (): ColumnState => ({ term: '', expanded: [], searching: false, failed: false })
  const columnOf = (esField: string): ColumnState => columns.value[esField] ?? newColumn()

  function patchColumn(esField: string, patch: Partial<ColumnState>) {
    columns.value = { ...columns.value, [esField]: { ...columnOf(esField), ...patch } }
  }

  // Kept out of `columns`: a reactive proxy breaks the native `abort()`.
  const columnControllers = new Map<string, AbortController>()
  let countsController: AbortController | null = null

  /**
   * (Re)load one column's faceted values with its current term (and expanded levels for a tree),
   * superseding its previous request whatever started it. Counts exclude the column's own
   * selection so its other values stay visible. Date ranges have no values list.
   */
  async function fetchColumn(dataIndex: GeoNetworkIndexConnection, field: IndexField) {
    if (field.type === 'dateRange') return
    const { esField } = field
    columnControllers.get(esField)?.abort()
    const controller = new AbortController()
    columnControllers.set(esField, controller)
    patchColumn(esField, { searching: true })

    try {
      const { signal } = controller
      const { term: search, expanded } = columnOf(esField)
      const filters = toFilterState(activeFilters.value, esField)
      const values = await (field.type === 'tree'
        ? fetchTreeValues(dataIndex, field, filters, { expanded, search }, signal)
        : fetchFieldValues(dataIndex, field, filters, { signal, search }))
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

  // Bounds cover the whole layer, so they load once per layer: refetched only while unknown.
  let boundsLoaded = false

  /** Date bounds of the date-range columns. */
  async function fetchBounds(dataIndex: GeoNetworkIndexConnection, signal: AbortSignal) {
    try {
      const entries = await Promise.all(
        fields.value.flatMap((field) =>
          field.type === 'dateRange'
            ? [fetchDateBounds(dataIndex, field, signal).then((b) => [field.esField, b] as const)]
            : [],
        ),
      )
      if (signal.aborted) return
      dateBounds.value = Object.fromEntries(entries)
      boundsLoaded = true
      boundsFailed.value = false
    } catch (e) {
      if (signal.aborted) return
      console.error('Erreur lors du chargement des bornes de dates ElasticSearch:', e)
      boundsFailed.value = true
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
      ...(boundsLoaded ? [] : [fetchBounds(dataIndex, signal)]),
    ])
    if (!signal.aborted) loading.value = false
  }

  /** Re-query one column for its current search term and expanded levels, leaving the others. */
  async function requeryColumn(esField: string) {
    const dataIndex = dataIndexOf(toValue(layer))
    const field = fields.value.find((f) => f.esField === esField)
    if (!dataIndex || !field) return
    await fetchColumn(dataIndex, field)
  }

  /** Re-query one column's values for `term`, leaving the other columns untouched. */
  function searchValues(esField: string, term: string) {
    patchColumn(esField, { term })
    return requeryColumn(esField)
  }

  /** Set a tree column's expanded paths; newly expanded levels load (collapsing needs nothing). */
  function setExpanded(esField: string, paths: string[]) {
    const { term, expanded } = columnOf(esField)
    const previous = new Set(expanded)
    patchColumn(esField, { expanded: paths })
    // While searching, the matches come with all their ancestors already.
    if (term) return
    if (paths.some((path) => !previous.has(path))) return requeryColumn(esField)
  }

  function cancelAll() {
    countsController?.abort()
    columnControllers.forEach((c) => c.abort())
    columnControllers.clear()
  }

  /** Fresh columns, tree ones expanded down to their selected paths so a restored selection shows. */
  function initialColumns(): Record<string, ColumnState> {
    const initial: Record<string, ColumnState> = {}
    for (const field of fields.value) {
      if (field.type !== 'tree') continue
      const selected = activeFilters.value.values[field.esField] ?? []
      initial[field.esField] = {
        ...newColumn(),
        expanded: [...new Set(selected.flatMap(ancestorPaths))],
      }
    }
    return initial
  }

  async function load() {
    cancelAll()
    columns.value = initialColumns()
    dateBounds.value = {}
    boundsLoaded = false
    if (!dataIndexOf(toValue(layer))) {
      count.value = null
      totalCount.value = null
      return
    }
    normalizePersistedFilter()
    loading.value = true
    countsFailed.value = false
    boundsFailed.value = false
    await refresh(true)
  }

  /**
   * Rewrite a persisted filter that differs from what this panel writes for the same selections
   * (e.g. `equals` saved on a tokenized column before match types were kept), so the WMS matches
   * the counts without waiting for the user to touch the panel.
   */
  function normalizePersistedFilter() {
    const currentLayer = toValue(layer)
    if (!isLayerDataIndexed(currentLayer)) return
    const persisted = currentLayer.extras?.filter ?? []
    const normalized = toFilterState(activeFilters.value)
    if (JSON.stringify(persisted) !== JSON.stringify(normalized)) {
      setActiveFilters(activeFilters.value)
    }
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

  // Separate from the count and column controllers: zooming must not abort an in-flight refresh.
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
      // No extent means nothing matched: the count, refreshed alongside, already says so.
      if (extent && !current.signal.aborted) mapStore.setView({ extent })
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

  // Serialized values, not the layer object: opacity or visibility updates must not supersede an
  // in-flight load. Either change drops a pending zoom, which must not move the map or report.
  watch([() => toValue(layer)?.id, () => JSON.stringify(activeFilters.value)], ([id], [oldId]) => {
    cancelZoom()
    if (id !== oldId) return load()
    return refresh()
  })
  load()

  onScopeDispose(() => {
    cancelAll()
    cancelZoom()
  })

  return {
    fields,
    geometryName,
    fieldValues,
    dateBounds: readonly(dateBounds),
    count: readonly(count),
    totalCount: readonly(totalCount),
    loading: readonly(loading),
    loadError,
    zoomError,
    searching,
    expandedPaths,
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
