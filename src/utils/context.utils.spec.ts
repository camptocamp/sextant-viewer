import { describe, expect, it } from 'vitest'
import { assertMapContext, isMapContext } from './context.utils'

describe('isMapContext', () => {
  it('accepts a context whose layer collections are arrays', () => {
    expect(isMapContext({ layers: [], backgroundLayers: [], view: { zoom: 2 } })).toBe(true)
  })

  it('accepts missing layer collections, which enrichment defaults to empty', () => {
    expect(isMapContext({})).toBe(true)
    expect(isMapContext({ layers: [{ type: 'wms' }] })).toBe(true)
  })

  it('accepts unknown keys, so contexts from a newer SDK still pass', () => {
    expect(isMapContext({ layers: [], somethingNew: 'x' })).toBe(true)
  })

  it('rejects values that are not plain objects', () => {
    expect(isMapContext(null)).toBe(false)
    expect(isMapContext(undefined)).toBe(false)
    expect(isMapContext('{}')).toBe(false)
    expect(isMapContext(42)).toBe(false)
    expect(isMapContext([])).toBe(false)
  })

  it('rejects non-array layer collections', () => {
    expect(isMapContext({ layers: 'x' })).toBe(false)
    expect(isMapContext({ layers: [], backgroundLayers: {} })).toBe(false)
  })
})

describe('assertMapContext', () => {
  it('passes a valid context through', () => {
    expect(() => assertMapContext({ layers: [] })).not.toThrow()
  })

  it('throws a TypeError naming the expected shape', () => {
    expect(() => assertMapContext({ layers: 'x' })).toThrow(TypeError)
    expect(() => assertMapContext(null)).toThrow(/backgroundLayers/)
  })
})
