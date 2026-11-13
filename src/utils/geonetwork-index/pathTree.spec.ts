import { describe, expect, it } from 'vitest'
import { ancestorPaths, buildPathTree, isWithin, parentPath } from './pathTree'

describe('path helpers', () => {
  it('reads the parent and the ancestors of a path', () => {
    expect(parentPath('A/B/C')).toBe('A/B')
    expect(parentPath('A')).toBeUndefined()
    expect(ancestorPaths('A/B/C')).toEqual(['A', 'A/B'])
    expect(ancestorPaths('A')).toEqual([])
  })

  it('tells a descendant from a sibling sharing a prefix', () => {
    expect(isWithin('A/B', 'A/B')).toBe(true)
    expect(isWithin('A/B/C', 'A/B')).toBe(true)
    expect(isWithin('A/BC', 'A/B')).toBe(false)
  })
})

describe('buildPathTree', () => {
  const allKnown = () => true

  it('nests the paths, siblings sorted by decreasing count at every level', () => {
    const tree = buildPathTree(
      [
        { value: 'A', count: 1 },
        { value: 'B', count: 5 },
        { value: 'B/x', count: 2 },
        { value: 'B/y', count: 3 },
      ],
      allKnown,
    )
    expect(tree).toEqual([
      {
        path: 'B',
        label: 'B',
        count: 5,
        children: [
          { path: 'B/y', label: 'y', count: 3, children: [] },
          { path: 'B/x', label: 'x', count: 2, children: [] },
        ],
      },
      { path: 'A', label: 'A', count: 1, children: [] },
    ])
  })

  it('breaks count ties by label', () => {
    const tree = buildPathTree(
      [
        { value: 'b', count: 2 },
        { value: 'a', count: 2 },
      ],
      allKnown,
    )
    expect(tree.map((node) => node.path)).toEqual(['a', 'b'])
  })

  it('ranks countless ancestors of search matches by their best match', () => {
    const tree = buildPathTree(
      [
        { value: 'A/rare', count: 2 },
        { value: 'B/frequent', count: 50 },
      ],
      allKnown,
    )
    expect(tree.map((node) => node.path)).toEqual(['B', 'A'])
  })

  it('creates the ancestors of a search match without a count', () => {
    const [root] = buildPathTree([{ value: 'A/B/coli', count: 4 }], allKnown)
    const middle = root!.children![0]!
    expect([root!.path, root!.count]).toEqual(['A', undefined])
    expect([middle.path, middle.count]).toEqual(['A/B', undefined])
    expect(middle.children).toEqual([{ path: 'A/B/coli', label: 'coli', count: 4, children: [] }])
  })

  it('leaves children undefined where they are not known yet', () => {
    const tree = buildPathTree(
      [
        { value: 'A', count: 2 },
        { value: 'A/x', count: 2 },
      ],
      (path) => !path.includes('/'),
    )
    expect(tree[0]!.children).toEqual([{ path: 'A/x', label: 'x', count: 2 }])
  })
})
