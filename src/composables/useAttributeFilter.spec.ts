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

  it('replacing the layer object with identical content neither aborts the load nor refetches', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()

    // The initial load's counts hang until released, simulating an in-flight load.
    const pending: Array<(v: number) => void> = []
    mocks.fetchCount.mockImplementation(() => new Promise<number>((r) => pending.push(r)))

    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    const callsDuringLoad = mocks.fetchFieldValues.mock.calls.length

    // An unrelated update (opacity, visibility) replaces the layer object with equal content.
    layer.value = { ...makeLayer(), opacity: 0.5 } as MapLayer
    await flush()
    expect(mocks.fetchFieldValues.mock.calls.length).toBe(callsDuringLoad)

    pending.forEach((resolve) => resolve(3))
    await flush()
    expect(api.loading.value).toBe(false)
    expect(api.count.value).toBe(3)
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

  it('a search refetches only the searched column, with its own faceting', async () => {
    const layer = ref(makeLayer([{ attributeName: 'B', matchType: 'equals', values: ['y'] }]))
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    mocks.fetchFieldValues.mockClear()
    mocks.fetchCount.mockClear()

    await api.searchValues('A', 'foo')

    expect(mocks.fetchFieldValues).toHaveBeenCalledTimes(1)
    const [, field, filters, , term] = mocks.fetchFieldValues.mock.calls[0]!
    expect(field.esField).toBe('A')
    expect(filters).toEqual([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    expect(term).toBe('foo')
    expect(mocks.fetchCount).not.toHaveBeenCalled()
    scope.stop()
  })

  it('a selection change keeps each column searched with its current term', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    await api.searchValues('A', 'foo')
    mocks.fetchFieldValues.mockClear()

    layer.value = {
      ...layer.value,
      extras: {
        ...layer.value.extras,
        filter: [{ attributeName: 'B', matchType: 'equals', values: ['y'] }],
      },
    } as MapLayer
    await flush()

    const termOf = (esField: string) =>
      mocks.fetchFieldValues.mock.calls.find((c) => c[1].esField === esField)?.[4]
    expect(termOf('A')).toBe('foo')
    expect(termOf('B')).toBeUndefined()
    scope.stop()
  })

  it('a superseded search does not overwrite the newer one', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()

    let releaseFirst!: () => void
    mocks.fetchFieldValues
      .mockImplementationOnce(
        (_index, field) =>
          new Promise((resolve) => {
            releaseFirst = () =>
              resolve({ esField: field.esField, values: [{ value: 'old', count: 1 }] })
          }),
      )
      .mockImplementationOnce((_index, field) =>
        Promise.resolve({ esField: field.esField, values: [{ value: 'new', count: 1 }] }),
      )

    const first = api.searchValues('A', 'o')
    await api.searchValues('A', 'ne')
    releaseFirst()
    await first

    expect(api.fieldValues.value.A?.values).toEqual([{ value: 'new', count: 1 }])
    expect(api.searching.value.A).toBe(false)
    scope.stop()
  })

  it('a search started before a selection change does not overwrite the refreshed values', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()

    let releaseSearch!: () => void
    mocks.fetchFieldValues.mockImplementationOnce(
      (_index, field) =>
        new Promise((resolve) => {
          releaseSearch = () =>
            resolve({ esField: field.esField, values: [{ value: 'stale', count: 9 }] })
        }),
    )
    const search = api.searchValues('A', 'st')

    mocks.fetchFieldValues.mockImplementation((_index, field) =>
      Promise.resolve({ esField: field.esField, values: [{ value: 'fresh', count: 1 }] }),
    )
    layer.value = makeLayer([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    await flush()
    releaseSearch()
    await search

    expect(api.fieldValues.value.A?.values).toEqual([{ value: 'fresh', count: 1 }])
    scope.stop()
  })

  it("a successful search clears its column's error but not another column's", async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.fetchFieldValues.mockRejectedValueOnce(new Error('A down'))
    await api.searchValues('A', 'a')
    mocks.fetchFieldValues.mockRejectedValueOnce(new Error('B down'))
    await api.searchValues('B', 'b')
    expect(api.error.value).not.toBeNull()

    await api.searchValues('A', 'a')
    expect(api.error.value).not.toBeNull()

    await api.searchValues('B', 'b')
    expect(api.error.value).toBeNull()
    scope.stop()
  })
})
