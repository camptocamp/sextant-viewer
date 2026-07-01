import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { MapLayer } from '@/utils/layer.utils'

const mocks = vi.hoisted(() => ({
  fetchFieldValues: vi.fn(),
  fetchCount: vi.fn(),
  updateLayer: vi.fn(),
}))

vi.mock('@/utils/geonetwork-index', () => ({
  fetchFieldValues: mocks.fetchFieldValues,
  fetchCount: mocks.fetchCount,
}))
vi.mock('@/stores/map.store', () => ({ useMapStore: () => ({ updateLayer: mocks.updateLayer }) }))

import { useAttributeFilter } from './useAttributeFilter'

const flush = () => new Promise((resolve) => setTimeout(resolve))

function makeLayer(filter: unknown[] = []): MapLayer {
  return {
    type: 'wms',
    name: 'lyr',
    version: 0,
    extras: {
      dataIndex: {
        url: '/es',
        featureTypeId: 'ft',
        fields: [
          { esField: 'A', label: 'A', aggField: 'ft_A_s', type: 'terms' },
          { esField: 'B', label: 'B', aggField: 'ft_B_s', type: 'terms' },
        ],
      },
      filter,
    },
  } as unknown as MapLayer
}

beforeEach(() => {
  mocks.fetchFieldValues.mockReset()
  mocks.fetchCount.mockReset()
  mocks.updateLayer.mockReset()
  mocks.fetchFieldValues.mockImplementation((_index, field) =>
    Promise.resolve({ esField: field.esField, values: [], truncated: false }),
  )
  mocks.fetchCount.mockResolvedValue(0)
})

afterEach(() => vi.restoreAllMocks())

describe('useAttributeFilter', () => {
  it('writes a toggled value as WmsFilterState on extras.filter and bumps the version', () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    scope.run(() => {
      const { toggleValue } = useAttributeFilter(() => layer.value)
      toggleValue('A', 'x')
    })

    expect(mocks.updateLayer).toHaveBeenCalledWith(
      layer.value,
      expect.objectContaining({
        extras: expect.objectContaining({
          filter: [{ attributeName: 'A', matchType: 'equals', values: ['x'] }],
        }),
        version: 1,
      }),
    )
    scope.stop()
  })

  it("faceting excludes each column's own selection", async () => {
    const layer = ref(makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }]))
    const scope = effectScope()
    scope.run(() => useAttributeFilter(() => layer.value))
    await flush()

    const callA = mocks.fetchFieldValues.mock.calls.find((c) => c[1].esField === 'A')
    const callB = mocks.fetchFieldValues.mock.calls.find((c) => c[1].esField === 'B')
    // Column A drops its own selection so its other values stay visible; column B keeps it.
    expect(callA?.[2]).toEqual([])
    expect(callB?.[2]).toEqual([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    scope.stop()
  })

  it('a superseded request does not clobber fresh state', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()

    // First load's two counts hang; every later count resolves to 7.
    const pending: Array<(v: number) => void> = []
    mocks.fetchCount
      .mockImplementationOnce(() => new Promise<number>((r) => pending.push(r)))
      .mockImplementationOnce(() => new Promise<number>((r) => pending.push(r)))
      .mockResolvedValue(7)

    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    expect(api.count.value).toBeNull()

    // A newer request supersedes the first via the activeFilters watch.
    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    expect(api.count.value).toBe(7)

    // Resolving the stale first-load counts must be ignored.
    pending.forEach((resolve) => resolve(999))
    await flush()
    expect(api.count.value).toBe(7)
    scope.stop()
  })
})
