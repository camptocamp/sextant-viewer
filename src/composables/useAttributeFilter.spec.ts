import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { MapLayer } from '@/utils/layer.utils'

const mocks = vi.hoisted(() => ({
  fetchFieldValues: vi.fn(),
  fetchCount: vi.fn(),
  fetchExtent: vi.fn(),
  updateLayer: vi.fn(),
  setView: vi.fn(),
}))

vi.mock('@/utils/geonetwork-index', () => ({
  fetchFieldValues: mocks.fetchFieldValues,
  fetchCount: mocks.fetchCount,
  fetchExtent: mocks.fetchExtent,
}))
vi.mock('@/stores/map.store', () => ({
  useMapStore: () => ({ updateLayer: mocks.updateLayer, setView: mocks.setView }),
}))

import { useAttributeFilter } from './useAttributeFilter'

const flush = () => new Promise((resolve) => setTimeout(resolve))

/** A `fetchFieldValues` implementation that resolves with `value` only once released. */
function heldValues(value: string) {
  let resolveValues!: () => void
  const impl = (_index: unknown, field: { esField: string }) =>
    new Promise((resolve) => {
      resolveValues = () => resolve({ esField: field.esField, values: [{ value, count: 1 }] })
    })
  return { impl, release: () => resolveValues() }
}

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
  mocks.fetchExtent.mockReset()
  mocks.setView.mockReset()
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

  it('an identical layer replacement neither aborts the load nor refetches', async () => {
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

  it('a selection change during the initial load still ends the loading state', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    mocks.fetchCount
      .mockImplementationOnce(() => new Promise<number>(() => {}))
      .mockImplementationOnce(() => new Promise<number>(() => {}))
      .mockResolvedValue(7)

    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    expect(api.loading.value).toBe(true)

    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    expect(api.loading.value).toBe(false)
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
    const [, field, filters, options] = mocks.fetchFieldValues.mock.calls[0]!
    expect(field.esField).toBe('A')
    expect(filters).toEqual([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    expect(options.search).toBe('foo')
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
      mocks.fetchFieldValues.mock.calls.find((c) => c[1].esField === esField)?.[3].search
    expect(termOf('A')).toBe('foo')
    expect(termOf('B')).toBe('')
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

  it('a search started before a selection change leaves the refreshed values', async () => {
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

  it('a column stays searching until its refresh lands', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    await api.searchValues('A', 'foo')

    const refreshA = heldValues('refresh')
    mocks.fetchFieldValues.mockImplementationOnce(refreshA.impl)
    layer.value = makeLayer([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    await flush()
    expect(api.searching.value.A).toBe(true)
    expect(api.searching.value.B).toBe(false)

    refreshA.release()
    await flush()
    expect(api.searching.value.A).toBe(false)
    scope.stop()
  })

  it('a search started during a refresh keeps its result when the refresh lands', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()

    const refreshA = heldValues('refresh')
    mocks.fetchFieldValues
      .mockImplementation((_index, field) =>
        Promise.resolve({ esField: field.esField, values: [{ value: 'refresh', count: 1 }] }),
      )
      .mockImplementationOnce(refreshA.impl)
    layer.value = makeLayer([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    await flush()

    mocks.fetchFieldValues.mockImplementationOnce((_index, field) =>
      Promise.resolve({ esField: field.esField, values: [{ value: 'new', count: 1 }] }),
    )
    await api.searchValues('A', 'new')
    refreshA.release()
    await flush()

    expect(api.fieldValues.value.A?.values).toEqual([{ value: 'new', count: 1 }])
    expect(api.fieldValues.value.B?.values).toEqual([{ value: 'refresh', count: 1 }])
    scope.stop()
  })

  it('a refresh landing does not end a search started during it', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()
    await api.searchValues('A', 'old')

    const refreshA = heldValues('refresh')
    mocks.fetchFieldValues.mockImplementationOnce(refreshA.impl)
    layer.value = makeLayer([{ attributeName: 'B', matchType: 'equals', values: ['y'] }])
    await flush()

    const searchA = heldValues('new')
    mocks.fetchFieldValues.mockImplementationOnce(searchA.impl)
    const search = api.searchValues('A', 'new')
    refreshA.release()
    await flush()
    expect(api.searching.value.A).toBe(true)

    searchA.release()
    await search
    expect(api.searching.value.A).toBe(false)
    expect(api.fieldValues.value.A?.values).toEqual([{ value: 'new', count: 1 }])
    scope.stop()
  })

  it('a column failing to load does not keep the other columns or the counts', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    let api!: ReturnType<typeof useAttributeFilter>
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchCount.mockResolvedValue(5)
    mocks.fetchFieldValues
      .mockImplementation((_index, field) =>
        Promise.resolve({ esField: field.esField, values: [{ value: 'ok', count: 1 }] }),
      )
      .mockRejectedValueOnce(new Error('A down'))
    scope.run(() => {
      api = useAttributeFilter(() => layer.value)
    })
    await flush()

    expect(api.loadError.value).not.toBeNull()
    expect(api.fieldValues.value.A).toBeUndefined()
    expect(api.fieldValues.value.B?.values).toEqual([{ value: 'ok', count: 1 }])
    expect(api.count.value).toBe(5)
    expect(api.loading.value).toBe(false)
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
    expect(api.loadError.value).not.toBeNull()

    await api.searchValues('A', 'a')
    expect(api.loadError.value).not.toBeNull()

    await api.searchValues('B', 'b')
    expect(api.loadError.value).toBeNull()
    scope.stop()
  })

  it('reports a zoom failure alongside a search failure', async () => {
    const layer = ref(makeLayer())
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.fetchFieldValues.mockRejectedValueOnce(new Error('A down'))
    await api.searchValues('A', 'a')
    mocks.fetchExtent.mockRejectedValueOnce(new Error('boom'))
    await api.zoomToSelection()

    expect(api.loadError.value).not.toBeNull()
    expect(api.zoomError.value).not.toBeNull()
    scope.stop()
  })

  it('zooms to the extent of the active selection', async () => {
    const filter = [{ attributeName: 'A', matchType: 'equals', values: ['x'] }]
    const layer = ref(makeLayer(filter))
    mocks.fetchExtent.mockResolvedValue([-5, 43, 8, 51])
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()

    expect(mocks.fetchExtent).toHaveBeenCalledWith(
      layer.value.extras!.dataIndex,
      filter,
      expect.any(AbortSignal),
    )
    expect(mocks.setView).toHaveBeenCalledWith({ extent: [-5, 43, 8, 51] })
    expect(api.zooming.value).toBe(false)
    expect(api.zoomError.value).toBeNull()
    scope.stop()
  })

  it('does nothing when the selection has no extent', async () => {
    const layer = ref(makeLayer())
    mocks.fetchExtent.mockResolvedValue(null)
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()

    expect(mocks.setView).not.toHaveBeenCalled()
    expect(api.zooming.value).toBe(false)
    expect(api.zoomError.value).toBeNull()
    scope.stop()
  })

  it('a successful zoom clears the previous zoom failure', async () => {
    const layer = ref(makeLayer())
    mocks.fetchExtent.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([0, 0, 1, 1])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()
    expect(api.zoomError.value).not.toBeNull()

    await api.zoomToSelection()
    expect(api.zoomError.value).toBeNull()
    scope.stop()
  })

  it('a zoom still pending when the layer changes is dropped', async () => {
    const layer = ref({ ...makeLayer(), id: 'a' } as MapLayer)
    let resolveExtent!: (extent: number[]) => void
    mocks.fetchExtent.mockImplementation(
      () => new Promise<number[]>((resolve) => (resolveExtent = resolve)),
    )
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    const zoom = api.zoomToSelection()
    layer.value = { ...makeLayer(), id: 'b' } as MapLayer
    await flush()
    resolveExtent([0, 0, 1, 1])
    await zoom

    expect(mocks.setView).not.toHaveBeenCalled()
    expect(api.zooming.value).toBe(false)
    expect(api.zoomError.value).toBeNull()
    scope.stop()
  })

  it('a zoom still pending when the panel closes is dropped', async () => {
    const layer = ref(makeLayer())
    let resolveExtent!: (extent: number[]) => void
    mocks.fetchExtent.mockImplementation(
      () => new Promise<number[]>((resolve) => (resolveExtent = resolve)),
    )
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    const zoom = api.zoomToSelection()
    scope.stop()
    resolveExtent([0, 0, 1, 1])
    await zoom

    expect(mocks.setView).not.toHaveBeenCalled()
  })

  it('a count refresh landing after a zoom failure does not hide it', async () => {
    const layer = ref(makeLayer())
    mocks.fetchExtent.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    let resolveCount!: (count: number) => void
    mocks.fetchCount.mockImplementation(
      () => new Promise<number>((resolve) => (resolveCount = resolve)),
    )
    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    await api.zoomToSelection()
    resolveCount(4)
    await flush()

    expect(api.count.value).toBe(4)
    expect(api.zoomError.value).not.toBeNull()
    scope.stop()
  })

  it('a zoom still pending when the selection changes is dropped', async () => {
    const layer = ref(makeLayer())
    let resolveExtent!: (extent: number[]) => void
    mocks.fetchExtent.mockImplementation(
      () => new Promise<number[]>((resolve) => (resolveExtent = resolve)),
    )
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    const zoom = api.zoomToSelection()
    mocks.fetchCount.mockResolvedValue(4)
    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    resolveExtent([0, 0, 1, 1])
    await zoom

    expect(mocks.setView).not.toHaveBeenCalled()
    expect(api.zooming.value).toBe(false)
    // Cancelling the zoom must not cancel the count refresh.
    expect(api.count.value).toBe(4)
    scope.stop()
  })

  it('changing the selection clears a previous zoom failure', async () => {
    const layer = ref(makeLayer())
    mocks.fetchExtent.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()
    expect(api.zoomError.value).not.toBeNull()

    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    expect(api.zoomError.value).toBeNull()
    scope.stop()
  })
})
