import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { getWmsOtherDimensions } from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { getDimensionDefaultValue, type WmsLayerDimension } from '@camptocamp/ogc-client'

/**
 * Bind a single non-time WMS dimension (elevation, band, …) to a `<USelect>`.
 * Enumerated comma-list values only — no start/end/period interval
 * expansion or units conversion. Add when a server declares an interval on a
 * non-time dimension.
 */
export function useWmsDimension(layer: MaybeRefOrGetter<MapLayer>, dimensionName: string) {
  const mapStore = useMapStore()
  const key = dimensionName.toUpperCase()

  const dimension = computed<WmsLayerDimension | null>(
    () => getWmsOtherDimensions(toValue(layer)).find((d) => d.name === dimensionName) ?? null,
  )

  const options = computed<string[]>(() => {
    const dim = dimension.value
    if (!dim) return []
    return dim.values.flatMap((v) => v.split(',')).map((v) => v.trim())
  })

  const value = computed<string | undefined>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).dimensionValues?.[key]
      return raw === undefined ? undefined : String(raw)
    },
    set: (val) => {
      const l = toValue(layer) as MapContextLayerWms
      const { [key]: _removed, ...others } = l.dimensionValues ?? {}
      const remaining = Object.keys(others).length > 0 ? others : undefined
      const dimensionValues = val ? { ...others, [key]: val } : remaining
      mapStore.updateLayer(l as MapLayer, { dimensionValues } as Partial<MapLayer>)
    },
  })

  function reset() {
    const dim = dimension.value
    const def = dim && getDimensionDefaultValue(dim)
    value.value = def ? String(def) : undefined
  }

  return { dimension, options, value, reset }
}
