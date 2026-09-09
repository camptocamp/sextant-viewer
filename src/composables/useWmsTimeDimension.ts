import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import {
  getDefaultWmsTime,
  getWmsTimeDimension,
  toDimensionDate,
  toWmsTime,
} from '@/utils/wms.utils'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { expandTimeInterval, type WmsLayerTimeDimension } from '@camptocamp/ogc-client'

// TimeInterval and Duration are not exported by ogc-client's index; extract them structurally.
type TimeInterval = Extract<WmsLayerTimeDimension['values'], { period: unknown }>
type Duration = TimeInterval['period']

/** An interval whose period has a constant length, kept as arithmetic rather than enumerated. */
type Grid = { begin: number; end: number; stepMs: number }

const DAY_MS = 86_400_000

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const isInterval = (value: unknown): value is TimeInterval =>
  typeof value === 'object' && value !== null && 'period' in value

/**
 * Step length in ms, or null for a calendar period (years/months) whose steps are not
 * constant-length and must be walked by calendar arithmetic instead.
 */
function fixedStepMs(period: Duration): number | null {
  if (period.years || period.months) return null
  const ms =
    ((period.days * 24 + period.hours) * 60 + period.minutes) * 60_000 + period.seconds * 1000
  return ms > 0 ? ms : null
}

/** First grid instant falling inside the given UTC day, or null if the grid skips that day. */
function firstGridInstantOfDay(grid: Grid, dayStart: number): number | null {
  const offset = Math.max(0, Math.ceil((dayStart - grid.begin) / grid.stepMs))
  const first = grid.begin + offset * grid.stepMs
  return first <= grid.end && first < dayStart + DAY_MS ? first : null
}

export function useWmsTimeDimension(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const timeDim = computed<WmsLayerTimeDimension | null>(() => getWmsTimeDimension(toValue(layer)))

  /**
   * The dimension's values split by how they are best interrogated, not by how they are declared.
   * A dense grid (sub-day or daily) has a constant-length step in UTC, so it is answered by closed
   * form and never enumerated — which is what removes any need for a value cap. A calendar grid
   * needs arithmetic ogc-client does not export, but yields at most twelve instants a year, so it
   * enumerates safely; `expandTimeInterval`'s own default only bites past three centuries.
   */
  const parts = computed<{ instants: Date[]; grids: Grid[] }>(() => {
    const instants: Date[] = []
    const grids: Grid[] = []
    const dim = timeDim.value
    if (!dim) return { instants, grids }

    // `values` is typed non-nullable but arrives null through the WMS 1.1.x <Extent> inheritance
    // path, and a lone interval is not wrapped in an array.
    const values: unknown = dim.values
    const declared = values == null ? [] : Array.isArray(values) ? values : [values]

    // Element by element: the parser casts a mixed list to Date[] | TimeInterval[], so a dimension
    // declaring both a date and an interval really does yield a heterogeneous array.
    for (const value of declared) {
      const instant = toDimensionDate(value)
      if (instant) {
        instants.push(instant)
        continue
      }
      if (!isInterval(value)) continue
      const { period } = value
      // Typed non-optional, yet null on a malformed <Extent> — and expandTimeInterval throws there.
      const begin = toDimensionDate(value.begin)
      const end = toDimensionDate(value.end)
      if (!begin || !end || !period) continue

      const stepMs = fixedStepMs(period)
      // Rebuild the interval: expandTimeInterval calls getTime() on begin/end, which a cached
      // capabilities read hands over as ISO strings.
      if (stepMs === null) instants.push(...expandTimeInterval({ begin, end, period }))
      else grids.push({ begin: begin.getTime(), end: end.getTime(), stepMs })
    }

    // The server may declare values in any order; stepping and snapping rely on the ordering.
    instants.sort((a, b) => a.getTime() - b.getTime())
    return { instants, grids }
  })

  const instantsByDay = computed<Map<number, Date[]>>(() => {
    const byDay = new Map<number, Date[]>()
    for (const instant of parts.value.instants) {
      const key = utcDayStart(instant)
      const bucket = byDay.get(key)
      if (bucket) bucket.push(instant)
      else byDay.set(key, [instant])
    }
    return byDay
  })

  const currentDate = computed<Date | null>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).timeValue
      // 'current' means the server picks; the calendar has no instant to point at.
      return raw === 'current' ? null : toDimensionDate(raw)
    },
    set: (date: Date | null) => {
      const l = toValue(layer) as MapContextLayerWms
      mapStore.updateLayer(
        l as MapLayer,
        {
          timeValue: date ? toWmsTime(date) : undefined,
        } as Partial<MapLayer>,
      )
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

  const bounds = computed<{ min: Date | null; max: Date | null }>(() => {
    const { instants, grids } = parts.value
    const times: number[] = []
    // instants is sorted, so its own bounds are its ends — no need to scan it.
    if (instants.length > 0)
      times.push(instants[0]!.getTime(), instants[instants.length - 1]!.getTime())
    for (const grid of grids) times.push(grid.begin, grid.end)
    if (times.length === 0) return { min: null, max: null }
    return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) }
  })

  const minDate = computed<Date | null>(() => bounds.value.min)
  const maxDate = computed<Date | null>(() => bounds.value.max)

  const supportsCurrent = computed(() => timeDim.value?.current ?? false)

  /** True when the server offers at least one instant on the given UTC day. */
  function isAllowedDay(day: Date): boolean {
    const dayStart = utcDayStart(day)
    if (instantsByDay.value.has(dayStart)) return true
    return parts.value.grids.some((grid) => firstGridInstantOfDay(grid, dayStart) !== null)
  }

  /**
   * The first exact instant offered on a UTC day, carrying the time component the server expects,
   * or null when the day holds none.
   */
  function snapToDay(day: Date): Date | null {
    const dayStart = utcDayStart(day)
    const candidates: number[] = []
    const first = instantsByDay.value.get(dayStart)?.[0]
    if (first) candidates.push(first.getTime())
    for (const grid of parts.value.grids) {
      const instant = firstGridInstantOfDay(grid, dayStart)
      if (instant !== null) candidates.push(instant)
    }
    return candidates.length > 0 ? new Date(Math.min(...candidates)) : null
  }

  /** The earliest instant strictly after `from`, across enumerated values and grids alike. */
  function next(from: Date): Date | null {
    const time = from.getTime()
    const candidates: number[] = []
    const instant = parts.value.instants.find((d) => d.getTime() > time)
    if (instant) candidates.push(instant.getTime())
    for (const grid of parts.value.grids) {
      if (time < grid.begin) {
        candidates.push(grid.begin)
        continue
      }
      const step = grid.begin + (Math.floor((time - grid.begin) / grid.stepMs) + 1) * grid.stepMs
      if (step <= grid.end) candidates.push(step)
    }
    return candidates.length > 0 ? new Date(Math.min(...candidates)) : null
  }

  /** The latest instant strictly before `from`, across enumerated values and grids alike. */
  function previous(from: Date): Date | null {
    const time = from.getTime()
    const { instants, grids } = parts.value
    const candidates: number[] = []
    for (let i = instants.length - 1; i >= 0; i--) {
      const instant = instants[i]!
      if (instant.getTime() < time) {
        candidates.push(instant.getTime())
        break
      }
    }
    for (const grid of grids) {
      const stepsToEnd = Math.floor((grid.end - grid.begin) / grid.stepMs)
      const index = time > grid.end ? stepsToEnd : Math.ceil((time - grid.begin) / grid.stepMs) - 1
      if (index >= 0) candidates.push(grid.begin + index * grid.stepMs)
    }
    return candidates.length > 0 ? new Date(Math.max(...candidates)) : null
  }

  const previousDate = computed<Date | null>(() =>
    currentDate.value ? previous(currentDate.value) : null,
  )
  const nextDate = computed<Date | null>(() => (currentDate.value ? next(currentDate.value) : null))

  /**
   * Exact instants available on a given UTC day, as "HH:MM" → Date: the enumerated values filtered
   * to that day, plus each grid walked across just that day.
   */
  function timesForDay(day: Date): Map<string, Date> {
    const dayStart = utcDayStart(day)
    const dayEnd = dayStart + DAY_MS
    const result = new Map<string, Date>()
    const key = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

    for (const instant of instantsByDay.value.get(dayStart) ?? []) result.set(key(instant), instant)
    for (const grid of parts.value.grids) {
      const first = firstGridInstantOfDay(grid, dayStart)
      if (first === null) continue
      for (let t = first; t <= grid.end && t < dayEnd; t += grid.stepMs) {
        const date = new Date(t)
        result.set(key(date), date)
      }
    }
    return result
  }

  return {
    currentDate,
    reset,
    setNow,
    minDate,
    maxDate,
    supportsCurrent,
    isAllowedDay,
    snapToDay,
    timesForDay,
    previousDate,
    nextDate,
  }
}
