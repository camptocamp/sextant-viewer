import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { getDefaultWmsTime, getWmsTimeDimension, toWmsTime } from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import {
  expandDimensionValues,
  parseIso8601DurationMs,
  type WmsLayerDimension,
} from '@camptocamp/ogc-client'

const DAY_MS = 86_400_000

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
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
      const remaining = Object.keys(otherDimensions).length > 0 ? otherDimensions : undefined
      const newDimensions = date ? { ...otherDimensions, TIME: toWmsTime(date) } : remaining
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

  // Bounds come from the raw dimension strings, not the (capped) expansion:
  // an interval "start/end/period" can exceed expandDimensionValues' value cap,
  // which would otherwise report a truncated, wrong maximum.
  const bounds = computed<{ min: Date | null; max: Date | null }>(() => {
    const dim = timeDim.value
    if (!dim || dim.values.length === 0) return { min: null, max: null }
    const edges = dim.values.flatMap((v) => {
      const [start, end] = v.split('/')
      return [start, end ?? start]
    })
    const times = edges
      .filter((s): s is string => !!s)
      .map((s) => new Date(s).getTime())
      .filter((t) => !isNaN(t))
    if (times.length === 0) return { min: null, max: null }
    return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) }
  })

  const minDate = computed<Date | null>(() => bounds.value.min)
  const maxDate = computed<Date | null>(() => bounds.value.max)

  const supportsCurrent = computed(() => timeDim.value?.current ?? false)

  // True when the server enumerates discrete dates (no "start/end/period" interval).
  // A list is safe to enumerate; an interval is truncated by expandDimensionValues'
  // cap and must be handled by range-bounding instead.
  const isEnumerated = computed(
    () => !!timeDim.value?.values.length && timeDim.value.values.every((v) => !v.includes('/')),
  )

  // Exact instants available on a given UTC day, as "HH:MM" → Date. Handles both
  // shapes the server may declare: an enumerated list (filter the expansion to
  // that day) and an interval "start/end/period" (walk the period grid across
  // just that day, anchored on the interval's start — avoids the value cap that
  // truncates a multi-year expansion). Sub-day grids are always PT… durations,
  // so a constant-ms step is exact; calendar periods (P1M…) yield no intra-day
  // times anyway.
  function timesForDay(day: Date): Map<string, Date> {
    const dim = timeDim.value
    const result = new Map<string, Date>()
    if (!dim) return result
    const dayStart = utcDayStart(day)
    const dayEnd = dayStart + DAY_MS
    const key = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

    for (const value of dim.values) {
      const [startStr, endStr, period] = value.split('/')
      if (!startStr) continue
      if (!period) {
        // Single enumerated instant
        const d = new Date(startStr)
        if (!isNaN(d.getTime()) && d.getTime() >= dayStart && d.getTime() < dayEnd)
          result.set(key(d), d)
        continue
      }
      const start = new Date(startStr).getTime()
      const end = new Date(endStr ?? startStr).getTime()
      const stepMs = parseIso8601DurationMs(period)
      if (isNaN(start) || isNaN(end) || !stepMs) continue
      // First grid instant at or after the day's start, then walk within the day.
      const offset = Math.max(0, Math.ceil((dayStart - start) / stepMs))
      for (let t = start + offset * stepMs; t <= end && t < dayEnd; t += stepMs) {
        const d = new Date(t)
        result.set(key(d), d)
      }
    }
    return result
  }

  return {
    currentDate,
    reset,
    setNow,
    allowedDates,
    minDate,
    maxDate,
    supportsCurrent,
    isEnumerated,
    timesForDay,
  }
}
