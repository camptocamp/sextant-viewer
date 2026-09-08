import { computed, shallowRef, watchEffect, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { getDefaultValue } from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { WmsEndpoint, type WmsLayerDimension } from '@camptocamp/ogc-client'

/** Convert dimension values to string array for UI display. */
function getDimensionStringValues(dim: WmsLayerDimension): string[] {
  const values = dim.values
  if (Array.isArray(values)) {
    return values.map((v) => (typeof v === 'object' && 'value' in v ? String(v.value) : String(v)))
  }
  // Interval - not expanding, just return empty (UI can show min/max if needed)
  return []
}

/**
 * Bind a single non-time WMS dimension (elevation, band, …) to a `<USelect>`.
 */
export function useWmsDimension(layer: MaybeRefOrGetter<MapLayer>, dimensionName: string) {
  const mapStore = useMapStore()
  const key = dimensionName.toUpperCase()

  const dimension = shallowRef<WmsLayerDimension | null>(null)
  const loading = shallowRef(false)

  watchEffect(async () => {
    const l = toValue(layer)
    if (l.type !== 'wms') {
      dimension.value = null
      return
    }

    loading.value = true
    try {
      const endpoint = await new WmsEndpoint(l.url).isReady()
      const info = endpoint.getLayerByName(l.name)
      const dims = info?.otherDimensions as WmsLayerDimension[] | undefined
      dimension.value = dims?.find((d) => d.name === dimensionName) ?? null

      // Set default value ASAP if dimension requires it and none is set
      if (dimension.value && l.dimensionValues?.[key] === undefined) {
        const defaultVal = getDefaultValue(dimension.value)
        if (defaultVal !== null) {
          mapStore.updateLayer(l, {
            dimensionValues: { ...l.dimensionValues, [key]: defaultVal },
          } as Partial<MapLayer>)
        }
      }
    } catch (e) {
      console.error(`Failed to fetch WMS dimension ${dimensionName}`, e)
      dimension.value = null
    } finally {
      loading.value = false
    }
  })

  const options = computed<string[]>(() => {
    const dim = dimension.value
    if (!dim) return []
    return getDimensionStringValues(dim)
  })

  const value = computed<string | undefined>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).dimensionValues?.[key]
      return raw === undefined ? undefined : String(raw)
    },
    set: (val) => {
      const l = toValue(layer) as MapContextLayerWms
      const { [key]: _removed, ...others } = l.dimensionValues ?? {}
      const dimensionValues = val
        ? { ...others, [key]: val }
        : Object.keys(others).length > 0
          ? others
          : undefined
      mapStore.updateLayer(l as MapLayer, { dimensionValues } as Partial<MapLayer>)
    },
  })

  function reset() {
    const dim = dimension.value
    const def = dim && getDefaultValue(dim)
    value.value = def !== null ? String(def) : undefined
  }

  return { dimension, loading, options, value, reset }
}

/**
 * Get all non-time dimensions for a WMS layer.
 * Used by WmsDimensionsDetails to know which dimension fields to render.
 */
export function useWmsOtherDimensions(layer: MaybeRefOrGetter<MapLayer>) {
  const dimensions = shallowRef<WmsLayerDimension[]>([])
  const loading = shallowRef(false)

  watchEffect(async () => {
    const l = toValue(layer)
    if (l.type !== 'wms') {
      dimensions.value = []
      return
    }

    loading.value = true
    try {
      const endpoint = await new WmsEndpoint(l.url).isReady()
      const info = endpoint.getLayerByName(l.name)
      // Filter to dimensions with more than one value (nothing to choose otherwise)
      const dims = (info?.otherDimensions ?? []) as WmsLayerDimension[]
      dimensions.value = dims.filter((dim) => getDimensionStringValues(dim).length > 1)
    } catch (e) {
      console.error('Failed to fetch WMS dimensions', e)
      dimensions.value = []
    } finally {
      loading.value = false
    }
  })

  return { dimensions, loading }
}
