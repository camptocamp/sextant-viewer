import { describe, expect, it, vi } from 'vitest'
import type { MapLayer } from '@/utils/layer.utils'
import type { WmsLayerTimeDimension } from '@camptocamp/ogc-client'

const mocks = vi.hoisted(() => ({ updateLayer: vi.fn() }))

vi.mock('@/stores/map.store', () => ({ useMapStore: () => ({ updateLayer: mocks.updateLayer }) }))

import { useWmsTimeDimension } from './useWmsTimeDimension'

type TimeValues = WmsLayerTimeDimension['values']

function makeLayer(values: TimeValues, time: unknown, defaultValue?: Date): MapLayer {
  const dimension: WmsLayerTimeDimension = {
    name: 'time',
    isTime: true,
    values,
    defaultValue,
    nearestValue: false,
    multipleValues: false,
    current: false,
  }
  return {
    type: 'wms',
    name: 'lyr',
    timeValue: time,
    extras: { wmsDimensions: [dimension] },
  } as unknown as MapLayer
}

type Duration = {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

const duration = (part: Partial<Duration>): Duration => ({
  years: 0,
  months: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  ...part,
})

// A one-element list, the shape `normalizeDimension` produces from any declared interval form.
const interval = (begin: string, end: string, period: Duration) =>
  [{ begin: new Date(begin), end: new Date(end), period }] as unknown as TimeValues

const MONTHS = [
  new Date('2002-01-15T00:00:00Z'),
  new Date('2002-02-15T00:00:00Z'),
  new Date('2002-03-15T00:00:00Z'),
]

describe('useWmsTimeDimension', () => {
  it('steps to the adjacent declared value of an enumerated list', () => {
    const { previousDate, nextDate } = useWmsTimeDimension(makeLayer(MONTHS, MONTHS[1]!))

    expect(previousDate.value?.toISOString()).toBe('2002-01-15T00:00:00.000Z')
    expect(nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('orders neighbours by date, not by declaration order', () => {
    const shuffled = [MONTHS[2]!, MONTHS[0]!, MONTHS[1]!]
    const { previousDate, nextDate } = useWmsTimeDimension(makeLayer(shuffled, MONTHS[1]!))

    expect(previousDate.value?.toISOString()).toBe('2002-01-15T00:00:00.000Z')
    expect(nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('reports no neighbour beyond either end of the series', () => {
    const first = useWmsTimeDimension(makeLayer(MONTHS, MONTHS[0]!))
    expect(first.previousDate.value).toBeNull()
    expect(first.nextDate.value).not.toBeNull()

    const last = useWmsTimeDimension(makeLayer(MONTHS, MONTHS[2]!))
    expect(last.previousDate.value).not.toBeNull()
    expect(last.nextDate.value).toBeNull()
  })

  it('steps through an interval, which the capped expansion could not do', () => {
    const monthly = interval(
      '2002-01-15T00:00:00Z',
      '2020-12-15T00:00:00Z',
      duration({ months: 1 }),
    )
    const { previousDate, nextDate } = useWmsTimeDimension(makeLayer(monthly, MONTHS[1]!))

    expect(previousDate.value?.toISOString()).toBe('2002-01-15T00:00:00.000Z')
    expect(nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('reports an interval bounds without enumerating it', () => {
    const daily = interval('2002-01-01T00:00:00Z', '2002-01-31T00:00:00Z', duration({ days: 1 }))
    const { minDate, maxDate } = useWmsTimeDimension(makeLayer(daily, null))
    expect(minDate.value?.toISOString()).toBe('2002-01-01T00:00:00.000Z')
    expect(maxDate.value?.toISOString()).toBe('2002-01-31T00:00:00.000Z')
  })

  it('reads a list mixing dates and intervals', () => {
    const mixed = [
      new Date('2001-06-01T00:00:00Z'),
      {
        begin: new Date('2002-01-01T00:00:00Z'),
        end: new Date('2002-01-03T00:00:00Z'),
        period: duration({ days: 1 }),
      },
    ] as unknown as TimeValues
    const { isAllowedDay, minDate, maxDate } = useWmsTimeDimension(makeLayer(mixed, null))

    expect(isAllowedDay(new Date('2001-06-01T00:00:00Z'))).toBe(true)
    expect(isAllowedDay(new Date('2002-01-02T00:00:00Z'))).toBe(true)
    expect(isAllowedDay(new Date('2001-07-01T00:00:00Z'))).toBe(false)
    expect(minDate.value?.toISOString()).toBe('2001-06-01T00:00:00.000Z')
    expect(maxDate.value?.toISOString()).toBe('2002-01-03T00:00:00.000Z')
  })

  it('steps past the 3650-value cap of the former expansion', () => {
    const daily = interval('1990-01-01T00:00:00Z', '2020-01-01T00:00:00Z', duration({ days: 1 }))
    const day5000 = new Date(Date.UTC(1990, 0, 1) + 5000 * 86_400_000)
    const { previousDate, nextDate, minDate, maxDate } = useWmsTimeDimension(
      makeLayer(daily, day5000),
    )

    expect(nextDate.value?.toISOString()).toBe(new Date(+day5000 + 86_400_000).toISOString())
    expect(previousDate.value?.toISOString()).toBe(new Date(+day5000 - 86_400_000).toISOString())
    // Bounds stay the declared ones: nothing was enumerated, so nothing was truncated.
    expect(minDate.value?.toISOString()).toBe('1990-01-01T00:00:00.000Z')
    expect(maxDate.value?.toISOString()).toBe('2020-01-01T00:00:00.000Z')
  })

  it('restricts a monthly interval to its grid days', () => {
    const monthly = interval(
      '2002-01-15T00:00:00Z',
      '2002-06-15T00:00:00Z',
      duration({ months: 1 }),
    )
    const { isAllowedDay } = useWmsTimeDimension(makeLayer(monthly, null))

    expect(isAllowedDay(new Date('2002-02-15T00:00:00Z'))).toBe(true)
    expect(isAllowedDay(new Date('2002-02-16T00:00:00Z'))).toBe(false)
    expect(isAllowedDay(new Date('2002-07-15T00:00:00Z'))).toBe(false)
  })

  it('allows every day of a sub-day grid and steps within it', () => {
    const hourly = interval('2002-01-01T00:00:00Z', '2002-01-03T18:00:00Z', duration({ hours: 6 }))
    const { isAllowedDay, timesForDay, snapToDay } = useWmsTimeDimension(makeLayer(hourly, null))

    expect(isAllowedDay(new Date('2002-01-02T00:00:00Z'))).toBe(true)
    expect(isAllowedDay(new Date('2002-01-04T00:00:00Z'))).toBe(false)
    expect([...timesForDay(new Date('2002-01-02T00:00:00Z')).keys()]).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
    ])
    expect(snapToDay(new Date('2002-01-02T00:00:00Z'))?.toISOString()).toBe(
      '2002-01-02T00:00:00.000Z',
    )
  })

  it('snaps a day to the exact instant the server offers, and to null off-grid', () => {
    const dated = [new Date('2002-01-15T09:30:00Z')]
    const { snapToDay } = useWmsTimeDimension(makeLayer(dated, null))

    expect(snapToDay(new Date('2002-01-15T00:00:00Z'))?.toISOString()).toBe(
      '2002-01-15T09:30:00.000Z',
    )
    expect(snapToDay(new Date('2002-01-16T00:00:00Z'))).toBeNull()
  })

  it('offers intra-day times for a sub-day period only', () => {
    const threeHourly = interval(
      '2002-01-01T00:00:00Z',
      '2002-01-02T00:00:00Z',
      duration({ hours: 3 }),
    )
    const { timesForDay } = useWmsTimeDimension(makeLayer(threeHourly, null))
    expect(timesForDay(new Date('2002-01-01T00:00:00Z')).size).toBe(8)

    const monthly = interval(
      '2002-01-15T00:00:00Z',
      '2002-06-15T00:00:00Z',
      duration({ months: 1 }),
    )
    const monthlyDim = useWmsTimeDimension(makeLayer(monthly, null))
    expect(monthlyDim.timesForDay(new Date('2002-02-15T00:00:00Z')).size).toBe(1)
  })

  // Null values, malformed intervals and the ISO strings of a cached read are the boundary's
  // business: see the `enrichWmsDimensionsLayer` cases in `utils/wms.utils.spec.ts`.
  it('reports nothing for a dimension the boundary left empty', () => {
    const { minDate, isAllowedDay, nextDate } = useWmsTimeDimension(makeLayer([], null))
    expect(minDate.value).toBeNull()
    expect(isAllowedDay(new Date('2002-01-01T00:00:00Z'))).toBe(false)
    expect(nextDate.value).toBeNull()
  })

  it('writes the picked instant as a WMS time string', () => {
    mocks.updateLayer.mockClear()
    const layer = makeLayer(MONTHS, MONTHS[0]!)
    const { currentDate } = useWmsTimeDimension(layer)

    currentDate.value = MONTHS[1]!
    // The SDK forwards the string verbatim, milliseconds included — hence dropped here.
    expect(mocks.updateLayer).toHaveBeenCalledWith(layer, {
      timeValue: '2002-02-15T00:00:00Z',
    })
  })

  it('reads a restored string and the "current" literal', () => {
    const restored = useWmsTimeDimension(makeLayer(MONTHS, '2002-02-15T00:00:00.000Z'))
    expect(restored.currentDate.value?.toISOString()).toBe('2002-02-15T00:00:00.000Z')
    expect(restored.nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')

    const current = useWmsTimeDimension(makeLayer(MONTHS, 'current'))
    expect(current.currentDate.value).toBeNull()
  })
})
