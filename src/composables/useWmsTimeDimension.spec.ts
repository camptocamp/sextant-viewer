import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { MapLayer } from '@/utils/layer.utils'
import type { WmsLayerTimeDimension } from '@camptocamp/ogc-client'

vi.mock('@/stores/map.store', () => ({ useMapStore: () => ({ updateLayer: vi.fn() }) }))

// Mock factory must be self-contained - no external references
vi.mock('@camptocamp/ogc-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@camptocamp/ogc-client')>()
  return {
    ...original,
    WmsEndpoint: class MockWmsEndpoint {
      isReady() {
        return Promise.resolve({
          getLayerByName: (globalThis as unknown as { __mockGetLayerByName: () => unknown })
            .__mockGetLayerByName,
        })
      }
    },
  }
})

import { useWmsTimeDimension } from './useWmsTimeDimension'

interface TimeInterval {
  begin: Date
  end: Date
  period: {
    years: number
    months: number
    days: number
    hours: number
    minutes: number
    seconds: number
  }
}

function makeDimension(values: Date[] | TimeInterval): WmsLayerTimeDimension {
  return {
    name: 'time',
    isTime: true,
    values,
    defaultValue: Array.isArray(values) ? values[0]! : values.begin,
    nearestValue: false,
    multipleValues: false,
    current: false,
  }
}

function makeLayer(time: string): MapLayer {
  return {
    type: 'wms',
    url: 'https://example.com/wms',
    name: 'lyr',
    dimensionValues: { TIME: time },
  } as unknown as MapLayer
}

const MONTHS_STR = ['2002-01-15T00:00:00Z', '2002-02-15T00:00:00Z', '2002-03-15T00:00:00Z']
const MONTHS = MONTHS_STR.map((s) => new Date(s))

// Helper to wait for async watchEffect
async function flushPromises() {
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
  await nextTick()
}

// Use globalThis to share state with hoisted mock
function setMockLayerInfo(info: { timeDimension?: WmsLayerTimeDimension }) {
  ;(globalThis as unknown as { __mockGetLayerByName: () => typeof info }).__mockGetLayerByName =
    () => info
}

describe('useWmsTimeDimension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('steps to the adjacent declared value of an enumerated list', async () => {
    setMockLayerInfo({ timeDimension: makeDimension(MONTHS) })

    const { previousDate, nextDate } = useWmsTimeDimension(makeLayer(MONTHS_STR[1]!))

    await flushPromises()

    expect(previousDate.value?.toISOString()).toBe('2002-01-15T00:00:00.000Z')
    expect(nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('orders neighbours by date, not by declaration order', async () => {
    const shuffled = [MONTHS[2]!, MONTHS[0]!, MONTHS[1]!]
    setMockLayerInfo({ timeDimension: makeDimension(shuffled) })

    const { previousDate, nextDate } = useWmsTimeDimension(makeLayer(MONTHS_STR[1]!))

    await flushPromises()

    expect(previousDate.value?.toISOString()).toBe('2002-01-15T00:00:00.000Z')
    expect(nextDate.value?.toISOString()).toBe('2002-03-15T00:00:00.000Z')
  })

  it('reports no neighbour beyond either end of the series', async () => {
    setMockLayerInfo({ timeDimension: makeDimension(MONTHS) })

    const first = useWmsTimeDimension(makeLayer(MONTHS_STR[0]!))
    await flushPromises()
    expect(first.previousDate.value).toBeNull()
    expect(first.nextDate.value).not.toBeNull()

    const last = useWmsTimeDimension(makeLayer(MONTHS_STR[2]!))
    await flushPromises()
    expect(last.previousDate.value).not.toBeNull()
    expect(last.nextDate.value).toBeNull()
  })

  it('offers no stepping on an interval dimension', async () => {
    const interval: TimeInterval = {
      begin: new Date('2002-01-15T00:00:00Z'),
      end: new Date('2020-12-15T00:00:00Z'),
      period: { years: 0, months: 1, days: 0, hours: 0, minutes: 0, seconds: 0 },
    }
    setMockLayerInfo({ timeDimension: makeDimension(interval) })

    const { previousDate, nextDate, isEnumerated } = useWmsTimeDimension(makeLayer(MONTHS_STR[1]!))

    await flushPromises()

    expect(isEnumerated.value).toBe(false)
    expect(previousDate.value).toBeNull()
    expect(nextDate.value).toBeNull()
  })
})
