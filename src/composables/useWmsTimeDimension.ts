import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { getDefaultWmsTime, getWmsTimeDimension, type MapLayer } from '@/utils/layer.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import type { WmsLayerDimension } from '@camptocamp/ogc-client'

/**
 * Parse an ISO 8601 duration string (e.g. "P1D", "PT1H") into milliseconds.
 */
function parseDurationMs(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  )
  if (!match) return 0
  const days = Number(match[3] ?? 0)
  const hours = Number(match[4] ?? 0)
  const minutes = Number(match[5] ?? 0)
  const seconds = Number(match[6] ?? 0)
  return (days * 86400 + hours * 3600 + minutes * 60 + seconds) * 1000
}

/**
 * Expand WMS TIME values into Date objects.
 * Each entry is either an ISO datetime or an interval "start/end/period".
 * Capped at 3650 entries to prevent UI freezes on dense time series.
 */
function expandValues(values: string[]): Date[] {
  const MAX = 3650
  const dates: Date[] = []
  let truncated = false
  for (const value of values) {
    if (dates.length >= MAX) {
      truncated = true
      break
    }
    const parts = value.split('/')
    if (parts.length === 3) {
      const startStr = parts[0] ?? ''
      const endStr = parts[1] ?? ''
      const periodStr = parts[2] ?? ''
      const start = new Date(startStr)
      const end = new Date(endStr)
      const stepMs = parseDurationMs(periodStr)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || stepMs <= 0) continue
      for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
        if (dates.length >= MAX) {
          truncated = true
          break
        }
        dates.push(new Date(t))
      }
    } else {
      const d = new Date(value)
      if (!isNaN(d.getTime())) dates.push(d)
    }
  }
  if (truncated) {
    console.warn(
      `WMS TIME dimension has more than ${MAX} values; the date picker only offers the first ${MAX}.`,
    )
  }
  return dates
}

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
    return expandValues(dim.values)
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
