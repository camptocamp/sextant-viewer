import { describe, expect, it, vi } from 'vitest'
import type { MapLayer } from '@/utils/layer.utils'
import type { WmsLayerDimension } from '@camptocamp/ogc-client'

vi.mock('@/stores/map.store', () => ({ useMapStore: () => ({ updateLayer: vi.fn() }) }))

import { useWmsTimeDimension } from './useWmsTimeDimension'

function makeLayer(values: string[], time: string): MapLayer {
  const dimension: WmsLayerDimension = {
    name: 'time',
    units: 'ISO8601',
    values,
    defaultValue: values[0]!,
    nearestValue: false,
    multipleValues: false,
    current: false,
  }
  return {
    type: 'wms',
    name: 'lyr',
    dimensionValues: { TIME: time },
    extras: { wmsDimensions: [dimension] },
  } as unknown as MapLayer
}

const MONTHS = ['2002-01-15T00:00:00Z', '2002-02-15T00:00:00Z', '2002-03-15T00:00:00Z']

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

  it('offers no stepping on an interval dimension', () => {
    const layer = makeLayer(['2002-01-15T00:00:00Z/2020-12-15T00:00:00Z/P1M'], MONTHS[1]!)
    const { previousDate, nextDate, isEnumerated } = useWmsTimeDimension(layer)

    expect(isEnumerated.value).toBe(false)
    expect(previousDate.value).toBeNull()
    expect(nextDate.value).toBeNull()
  })
})
