import { computed, shallowRef, watchEffect, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { getDefaultValue } from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { WmsEndpoint, type WmsLayerTimeDimension } from '@camptocamp/ogc-client'

const DAY_MS = 86_400_000

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function useWmsTimeDimension(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  // Fetch dimension once and cache in closure
  const timeDim = shallowRef<WmsLayerTimeDimension | null>(null)
  const loading = shallowRef(false)

  watchEffect(async () => {
    const l = toValue(layer)
    if (l.type !== 'wms') {
      timeDim.value = null
      return
    }

    loading.value = true
    try {
      const endpoint = await new WmsEndpoint(l.url).isReady()
      const info = endpoint.getLayerByName(l.name)
      timeDim.value = info?.timeDimension ?? null

      // Set default value ASAP if dimension requires it and none is set
      if (timeDim.value && l.dimensionValues?.TIME === undefined) {
        const defaultVal = getDefaultValue(timeDim.value)
        if (defaultVal) {
          mapStore.updateLayer(l, {
            dimensionValues: { ...l.dimensionValues, TIME: defaultVal },
          } as Partial<MapLayer>)
        }
      }
    } catch (e) {
      console.error('Failed to fetch WMS time dimension', e)
      timeDim.value = null
    } finally {
      loading.value = false
    }
  })

  // Current value - read directly from layer.dimensionValues
  const currentDate = computed<Date | null>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).dimensionValues?.TIME
      if (!raw) return null
      return raw instanceof Date ? raw : new Date(String(raw))
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

  function reset() {
    const dim = timeDim.value
    if (!dim) return
    const def = getDefaultValue(dim)
    currentDate.value = def instanceof Date ? def : null
  }

  function setNow() {
    currentDate.value = new Date()
  }

  // Bounds from raw dimension values
  const minDate = computed<Date | null>(() => {
    const dim = timeDim.value
    if (!dim) return null
    const values = dim.values
    if (Array.isArray(values) && values.length > 0) {
      const first = values[0]
      if (first instanceof Date) {
        return new Date(Math.min(...(values as Date[]).map((d) => d.getTime())))
      }
      if (first && typeof first === 'object' && 'begin' in first) {
        const intervals = values as Array<{ begin: Date }>
        return new Date(Math.min(...intervals.map((i) => i.begin.getTime())))
      }
    }
    if (values && typeof values === 'object' && 'begin' in values) return values.begin
    return null
  })

  const maxDate = computed<Date | null>(() => {
    const dim = timeDim.value
    if (!dim) return null
    const values = dim.values
    if (Array.isArray(values) && values.length > 0) {
      const first = values[0]
      if (first instanceof Date) {
        return new Date(Math.max(...(values as Date[]).map((d) => d.getTime())))
      }
      if (first && typeof first === 'object' && 'begin' in first) {
        const intervals = values as Array<{ end: Date }>
        return new Date(Math.max(...intervals.map((i) => i.end.getTime())))
      }
    }
    if (values && typeof values === 'object' && 'end' in values) return values.end
    return null
  })

  const supportsCurrent = computed(() => timeDim.value?.current ?? false)

  // True when the server enumerates discrete dates (array of Date objects)
  const isEnumerated = computed(() => {
    const dim = timeDim.value
    if (!dim) return false
    const values = dim.values
    return Array.isArray(values) && values.length > 0 && values[0] instanceof Date
  })

  // Raw allowed dates for enumerated lists (empty for intervals - no pre-expansion)
  const allowedDates = computed<Date[]>(() =>
    isEnumerated.value ? (timeDim.value!.values as Date[]) : [],
  )

  // Find adjacent date in enumerated list (on-the-fly, no pre-expansion)
  function findNeighbour(direction: 1 | -1): Date | null {
    const dim = timeDim.value
    const current = currentDate.value
    if (!dim || !current || !isEnumerated.value) return null

    const dates = dim.values as Date[]
    const currentTime = current.getTime()
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())

    if (direction === 1) {
      return sorted.find((d) => d.getTime() > currentTime) ?? null
    }
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i]!.getTime() < currentTime) return sorted[i]!
    }
    return null
  }

  const previousDate = computed<Date | null>(() => findNeighbour(-1))
  const nextDate = computed<Date | null>(() => findNeighbour(1))

  // Times available on a given UTC day, as "HH:MM" → Date
  function timesForDay(day: Date): Map<string, Date> {
    const dim = timeDim.value
    const result = new Map<string, Date>()
    if (!dim) return result

    const dayStart = utcDayStart(day)
    const dayEnd = dayStart + DAY_MS
    const key = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

    const values = dim.values

    // Enumerated dates
    if (Array.isArray(values) && values.length > 0 && values[0] instanceof Date) {
      for (const d of values as Date[]) {
        const t = d.getTime()
        if (t >= dayStart && t < dayEnd) result.set(key(d), d)
      }
      return result
    }

    // Intervals - walk the period grid for this day
    // Skip if values is not a proper interval object
    if (typeof values !== 'object' || values === null) return result

    const intervals = Array.isArray(values) ? values : [values]
    for (const interval of intervals) {
      // Skip if interval doesn't have the expected structure
      if (!interval || typeof interval !== 'object' || !('begin' in interval)) continue

      const typedInterval = interval as { begin: Date; end: Date; period: unknown }
      const start = typedInterval.begin.getTime()
      const end = typedInterval.end.getTime()
      const period = typedInterval.period as { hours: number; minutes: number; seconds: number }
      if (!period) continue

      const stepMs = (period.hours * 3600 + period.minutes * 60 + period.seconds) * 1000
      if (!stepMs) continue

      const offset = Math.max(0, Math.ceil((dayStart - start) / stepMs))
      for (let t = start + offset * stepMs; t <= end && t < dayEnd; t += stepMs) {
        result.set(key(new Date(t)), new Date(t))
      }
    }

    return result
  }

  return {
    timeDim,
    loading,
    currentDate,
    reset,
    setNow,
    allowedDates,
    minDate,
    maxDate,
    supportsCurrent,
    isEnumerated,
    timesForDay,
    previousDate,
    nextDate,
  }
}
