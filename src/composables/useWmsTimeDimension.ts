import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { getDefaultWmsTime, getWmsTimeDimension, type MapLayer } from '@/utils/layer.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { expandDimensionValues, type WmsLayerDimension } from '@camptocamp/ogc-client'

export function useWmsTimeDimension(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const timeDim = computed<WmsLayerDimension | null>(() => getWmsTimeDimension(toValue(layer)))

  const currentDate = computed<Date | null>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).dimensionValues?.TIME
      if (!raw) return null
      if (raw instanceof Date) return raw
      const d = new Date(String(raw))
      return isNaN(d.getTime()) ? null : d
    },
    set: (date: Date | null) => {
      const l = toValue(layer) as MapContextLayerWms
      const { TIME: _removed, ...otherDimensions } = l.dimensionValues ?? {}
      const newDimensions = date
        ? { ...otherDimensions, TIME: date }
        : Object.keys(otherDimensions).length > 0
          ? otherDimensions
          : undefined
      mapStore.updateLayer(l as MapLayer, { dimensionValues: newDimensions } as Partial<MapLayer>)
    },
  })

  // Reset to the server's declared default, falling back to the first allowed
  // value — mirroring the initial TIME seeded during layer enrichment.
  function reset() {
    const dim = timeDim.value
    if (!dim) return
    currentDate.value = getDefaultWmsTime(dim)
  }

  function setNow() {
    currentDate.value = new Date()
  }

  const allowedDates = computed<Date[]>(() => {
    const dim = timeDim.value
    if (!dim || dim.values.length === 0) return []
    return expandDimensionValues(dim)
  })

  const minDate = computed<Date | null>(() => allowedDates.value[0] ?? null)
  const maxDate = computed<Date | null>(
    () => allowedDates.value[allowedDates.value.length - 1] ?? null,
  )

  const supportsCurrent = computed(() => timeDim.value?.current ?? false)

  // If nearestValue is false, only exact dates from the allowed list are valid
  const nearestValue = computed(() => timeDim.value?.nearestValue ?? true)

  return {
    currentDate,
    reset,
    setNow,
    allowedDates,
    minDate,
    maxDate,
    supportsCurrent,
    nearestValue,
  }
}
