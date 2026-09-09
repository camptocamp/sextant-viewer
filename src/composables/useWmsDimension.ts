import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import {
  getDimensionDefaultOption,
  getDimensionOptions,
  getWmsOtherDimensions,
  isElevationName,
  type AnyWmsDimension,
} from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'

/**
 * Bind a single non-time WMS dimension (elevation, band, …) to a `<USelect>`.
 * Enumerated values only — an interval yields no option. Add interval support when a
 * server declares one on a non-time dimension.
 *
 * The value stays a display string throughout: the SDK serialises by `toString()`, so
 * writing the string `getDimensionOptions` produced yields the exact same GetMap parameter
 * as writing the native value.
 */
export function useWmsDimension(layer: MaybeRefOrGetter<MapLayer>, dimensionName: string) {
  const mapStore = useMapStore()
  const isElevation = isElevationName(dimensionName)

  const dimension = computed<AnyWmsDimension | null>(
    () => getWmsOtherDimensions(toValue(layer)).find((d) => d.name === dimensionName) ?? null,
  )

  const options = computed<string[]>(() => {
    const dim = dimension.value
    return dim ? getDimensionOptions(dim) : []
  })

  const value = computed<string | undefined>({
    get: () => {
      const l = toValue(layer) as MapContextLayerWms
      const raw = isElevation ? l.elevationValue : l.otherDimensionValues?.[dimensionName]
      // Only a primitive matches one of the options; an interval has no matching entry.
      if (raw == null || typeof raw === 'object') return undefined
      return String(raw)
    },
    set: (val) => {
      const l = toValue(layer) as MapContextLayerWms
      if (isElevation) {
        mapStore.updateLayer(l as MapLayer, { elevationValue: val } as Partial<MapLayer>)
        return
      }
      const { [dimensionName]: _removed, ...others } = l.otherDimensionValues ?? {}
      const otherDimensionValues = val ? { ...others, [dimensionName]: val } : others
      mapStore.updateLayer(l as MapLayer, { otherDimensionValues } as Partial<MapLayer>)
    },
  })

  function reset() {
    const dim = dimension.value
    value.value = dim ? getDimensionDefaultOption(dim) : undefined
  }

  return { dimension, options, value, reset }
}
