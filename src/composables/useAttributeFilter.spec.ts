import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { MapLayer } from '@/utils/layer.utils'

const mocks = vi.hoisted(() => ({
  fetchFieldValues: vi.fn(),
  fetchTreeValues: vi.fn(),
  fetchDateBounds: vi.fn(),
  fetchCount: vi.fn(),
  fetchExtent: vi.fn(),
  updateLayer: vi.fn(),
  setView: vi.fn(),
}))

vi.mock('@/utils/geonetwork-index', () => ({
  fetchFieldValues: mocks.fetchFieldValues,
  fetchTreeValues: mocks.fetchTreeValues,
  fetchDateBounds: mocks.fetchDateBounds,
  fetchCount: mocks.fetchCount,
  fetchExtent: mocks.fetchExtent,
}))
vi.mock('@/stores/map.store', () => ({
  useMapStore: () => ({ updateLayer: mocks.updateLayer, setView: mocks.setView }),
}))

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
          { esField: 'A', label: 'A', aggField: 'ft_A_s', type: 'terms', matchType: 'equals' },
          { esField: 'B', label: 'B', aggField: 'ft_B_s', type: 'terms', matchType: 'equals' },
        ],
      },
      filter,
    },
  } as unknown as MapLayer
}

beforeEach(() => {
  mocks.fetchTreeValues.mockReset()
  mocks.fetchTreeValues.mockImplementation((_index, field) =>
    Promise.resolve({ esField: field.esField, values: [], truncated: false }),
  )
  mocks.fetchDateBounds.mockReset()
  mocks.fetchDateBounds.mockResolvedValue({ min: '1973-06-18', max: '2026-11-04' })
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
    expect(api.error.value).toBeNull()
    scope.stop()
  })

  it('reports an error instead of zooming when the selection has no extent', async () => {
    const layer = ref(makeLayer())
    mocks.fetchExtent.mockResolvedValue(null)
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()

    expect(mocks.setView).not.toHaveBeenCalled()
    expect(api.error.value).not.toBeNull()
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
    expect(api.error.value).not.toBeNull()

    await api.zoomToSelection()
    expect(api.error.value).toBeNull()
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
    expect(api.error.value).toBeNull()
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
    mocks.fetchExtent.mockResolvedValue(null)
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    await flush()

    await api.zoomToSelection()
    expect(api.error.value).not.toBeNull()

    layer.value = makeLayer([{ attributeName: 'A', matchType: 'equals', values: ['x'] }])
    await flush()
    expect(api.error.value).toBeNull()
    scope.stop()
  })
})

describe('useAttributeFilter with tree, date-range and area filters', () => {
  const DATE = {
    kind: 'dateRange',
    attributeName: 'D',
    minField: 'DMIN',
    maxField: 'DMAX',
    from: '2020-01-01',
    to: '2020-12-31',
  }
  const AREA = { kind: 'bbox', geometryName: 'geometry', extent: [-5, 48, -4, 49] }
  const valuesOf = (attributeName: string, values: string[]) => ({
    attributeName,
    matchType: 'equals',
    values,
  })
  const pathsOf = (values: string[]) => ({
    attributeName: 'P',
    matchType: 'tree',
    values,
    tokenSeparator: ';',
  })

  function makeRichLayer(filter: unknown[] = []): MapLayer {
    return {
      type: 'wms',
      name: 'lyr',
      version: 0,
      extras: {
        dataIndex: {
          url: '/es',
          featureTypeIds: ['ft'],
          geometryName: 'geometry',
          fields: [
            { esField: 'A', label: 'A', aggField: 'ft_A_s', type: 'terms', matchType: 'equals' },
            {
              esField: 'P',
              label: 'P',
              aggField: 'ft_P_s_tree',
              type: 'tree',
              tokenSeparator: ';',
            },
            { esField: 'D', label: 'D', type: 'dateRange', minField: 'DMIN', maxField: 'DMAX' },
          ],
        },
        filter,
      },
    } as unknown as MapLayer
  }

  function setup(filter: unknown[] = []) {
    const layer = ref(makeRichLayer(filter))
    const scope = effectScope()
    const api = scope.run(() => useAttributeFilter(() => layer.value))!
    return { layer, scope, api }
  }

  const writtenFilter = () => mocks.updateLayer.mock.lastCall?.[1].extras.filter

  it('applies the date range and the area to every column, including on faceting', async () => {
    const { scope } = setup([valuesOf('A', ['x']), DATE, AREA])
    await flush()

    expect(mocks.fetchFieldValues.mock.calls[0]![2]).toEqual([DATE, AREA])
    expect(mocks.fetchTreeValues.mock.calls[0]![2]).toEqual([valuesOf('A', ['x']), DATE, AREA])
    expect(mocks.fetchCount.mock.calls[0]![1]).toEqual([valuesOf('A', ['x']), DATE, AREA])
    scope.stop()
  })

  it('loads no value list for a date range, but its bounds with the layer', async () => {
    const { scope, api } = setup()
    await flush()

    expect(mocks.fetchFieldValues.mock.calls.map((c) => c[1].esField)).toEqual(['A'])
    expect(mocks.fetchDateBounds).toHaveBeenCalledTimes(1)
    expect(api.dateBounds.value).toEqual({ D: { min: '1973-06-18', max: '2026-11-04' } })
    scope.stop()
  })

  it('writes tree selections with their match type and token separator', () => {
    const { scope, api } = setup()
    api.toggleTreePath('P', 'x/y')
    expect(writtenFilter()).toEqual([pathsOf(['x/y'])])
    scope.stop()
  })

  it('selecting a tree path drops its selected descendants, not its siblings', () => {
    const { scope, api } = setup([pathsOf(['x/y/z', 'x/yz', 'w'])])
    api.toggleTreePath('P', 'x/y')
    expect(writtenFilter()).toEqual([pathsOf(['x/yz', 'w', 'x/y'])])
    scope.stop()
  })

  it('writes and clears the date range and the area', () => {
    const { scope, api } = setup()
    api.setDateRange('D', { from: '2020-01-01', to: '2020-12-31' })
    expect(writtenFilter()).toEqual([DATE])
    api.setBbox([-5, 48, -4, 49])
    expect(writtenFilter()).toEqual([AREA])
    scope.stop()

    const cleared = setup([DATE, AREA])
    cleared.api.setDateRange('D', null)
    expect(writtenFilter()).toEqual([AREA])
    cleared.api.setBbox(null)
    expect(writtenFilter()).toEqual([DATE])
    expect(cleared.api.hasActiveFilters.value).toBe(true)
    cleared.scope.stop()
  })

  it('expanding a tree node refetches that column with its levels; collapsing does not', async () => {
    const { scope, api } = setup()
    await flush()
    mocks.fetchTreeValues.mockClear()
    mocks.fetchFieldValues.mockClear()

    await api.setExpanded('P', ['x'])
    expect(mocks.fetchTreeValues).toHaveBeenCalledTimes(1)
    expect(mocks.fetchTreeValues.mock.calls[0]![3]).toEqual({ expanded: ['x'], search: undefined })
    expect(mocks.fetchFieldValues).not.toHaveBeenCalled()

    await api.setExpanded('P', [])
    expect(mocks.fetchTreeValues).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('a selection change refetches the tree with its expanded levels', async () => {
    const { layer, scope, api } = setup()
    await flush()
    await api.setExpanded('P', ['x'])
    mocks.fetchTreeValues.mockClear()

    layer.value = makeRichLayer([valuesOf('A', ['a'])])
    await flush()
    expect(mocks.fetchTreeValues.mock.calls[0]![3]).toEqual({ expanded: ['x'], search: undefined })
    scope.stop()
  })

  it('keeps reporting a date-bounds failure after the counts load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchDateBounds.mockRejectedValueOnce(new Error('boom'))
    const { layer, scope, api } = setup()
    await flush()
    expect(api.error.value).not.toBeNull()

    layer.value = makeRichLayer([valuesOf('A', ['a'])])
    await flush()
    expect(api.error.value).not.toBeNull()
    scope.stop()
  })

  it('a selection change during the initial load restarts it', async () => {
    let releaseBounds!: () => void
    mocks.fetchDateBounds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseBounds = () => resolve({ min: '1900-01-01', max: '1900-12-31' })
        }),
    )
    const { layer, scope, api } = setup()
    await flush()
    expect(api.loading.value).toBe(true)

    layer.value = makeRichLayer([valuesOf('A', ['a'])])
    await flush()
    expect(api.loading.value).toBe(false)
    expect(api.dateBounds.value).toEqual({ D: { min: '1973-06-18', max: '2026-11-04' } })

    releaseBounds()
    await flush()
    expect(api.dateBounds.value).toEqual({ D: { min: '1973-06-18', max: '2026-11-04' } })
    scope.stop()
  })

  it('expands the ancestors of a restored tree selection', async () => {
    const { scope, api } = setup([pathsOf(['x/y/z'])])
    await flush()
    expect(api.expandedPaths.value).toEqual({ P: ['x', 'x/y'] })
    expect(mocks.fetchTreeValues.mock.calls[0]![3]).toEqual({
      expanded: ['x', 'x/y'],
      search: undefined,
    })
    scope.stop()
  })
})
