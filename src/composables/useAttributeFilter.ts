import { computed, onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMapStore } from '@/stores/map.store'
import {
  buildFieldFilter,
  discoverFields,
  fetchCount,
  fetchFieldValues,
} from '@/utils/attributeIndex'
import { getAttributeFilterState, type MapLayer } from '@/utils/layer.utils'
import type { ActiveFilters } from '@/types/attribute-filter.types'
import type { AttributeFieldConfig, FieldValues } from '@/utils/attributeIndex.types'

// Stable fallback so unrelated `extras` changes don't yield a new `{}` and trip `watch(activeFilters)`.
const EMPTY_FILTERS: ActiveFilters = Object.freeze({})

/**
 * Drives the attribute-filter UI for a WMS layer whose ES index has been resolved:
 * discovers the filterable columns from the index, loads each column's values/counts,
 * and persists the user's selections on the layer (which re-renders the WMS layer with
 * the OGC FILTER).
 */
export function useAttributeFilter(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const fields = ref<AttributeFieldConfig[]>([])
  const fieldValues = ref<Record<string, FieldValues>>({})
  const count = ref<number | null>(null)
  const totalCount = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const state = computed(() => getAttributeFilterState(toValue(layer)))
  const activeFilters = computed<ActiveFilters>(() => state.value?.active ?? EMPTY_FILTERS)
  const hasActiveFilters = computed(() =>
    Object.values(activeFilters.value).some((values) => values.length > 0),
  )

  // Each new request aborts the previous one; every async write is gated on `signal.aborted`
  // so a superseded request can neither clobber newer state nor wipe a fresh error.
  let controller: AbortController | null = null

  function startRequest() {
    controller?.abort()
    controller = new AbortController()
    return controller.signal
  }

  const LOAD_ERROR =
    'Impossible de charger les valeurs depuis ElasticSearch. Vérifiez la connexion à l’index.'

  async function load() {
    const signal = startRequest()
    const current = state.value
    const currentLayer = toValue(layer)
    if (!current) return
    loading.value = true
    error.value = null
    try {
      const discovered = current.fields ?? (await discoverFields(current.source, signal))
      if (signal.aborted) return
      fields.value = discovered
      // Cache discovered fields on the layer so the OGC FILTER can be built from them.
      if (!current.fields) {
        mapStore.updateLayer(currentLayer, {
          extras: { ...currentLayer.extras, attributeFilter: { ...current, fields: discovered } },
        })
      }
      // refreshValues owns its own errors; here we only need to surface discovery failures.
      await refreshValues(signal, true)
    } catch (e) {
      // Skip a superseded/aborted request silently — neither is a real error.
      if (signal.aborted) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      error.value = LOAD_ERROR
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  /**
   * Refresh faceted value counts: each column's counts exclude its own selection so its other
   * values stay visible. Sole owner of `count`/`totalCount`/`fieldValues` so the paths never race.
   */
  async function refreshValues(signal: AbortSignal, withTotal = false) {
    const source = state.value?.source
    if (!source) return
    const active = activeFilters.value
    const clauseFor = (field: AttributeFieldConfig) =>
      buildFieldFilter(field, active[field.esField] ?? [])
    const activeFields = fields.value.filter((field) => active[field.esField]?.length)
    try {
      const [results, total, grandTotal] = await Promise.all([
        Promise.all(
          fields.value.map((field) =>
            fetchFieldValues(
              source,
              field,
              activeFields.filter((other) => other.esField !== field.esField).map(clauseFor),
              signal,
            ),
          ),
        ),
        fetchCount(source, activeFields.map(clauseFor), signal),
        withTotal ? fetchCount(source, [], signal) : Promise.resolve<number | null>(null),
      ])
      if (signal.aborted) return
      error.value = null
      count.value = total
      if (grandTotal !== null) totalCount.value = grandTotal
      fieldValues.value = Object.fromEntries(results.map((result) => [result.esField, result]))
    } catch (e) {
      if (signal.aborted) return
      console.error('Erreur lors du chargement des valeurs ElasticSearch:', e)
      error.value = LOAD_ERROR
    }
  }

  function setActiveFilters(active: ActiveFilters) {
    const currentLayer = toValue(layer)
    const current = getAttributeFilterState(currentLayer)
    if (!current) return

    const cleaned: ActiveFilters = {}
    for (const [field, values] of Object.entries(active)) {
      if (values.length > 0) cleaned[field] = values
    }

    mapStore.updateLayer(currentLayer, {
      extras: {
        ...currentLayer.extras,
        attributeFilter: { ...current, active: cleaned },
      },
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

  // Rediscover fields on layer change; on a selection change, only refresh the faceted counts.
  watch(() => toValue(layer)?.id, load, { immediate: true })
  watch(activeFilters, () => {
    refreshValues(startRequest())
  })

  // Cancel any in-flight request when the panel is torn down.
  onScopeDispose(() => controller?.abort())

  return {
    fields: readonly(fields),
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
