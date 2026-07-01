import { describe, expect, it } from 'vitest'
import { buildFilterBody, buildWmsFilterParam } from './wms.utils'
import type { FilterByAttribute } from '@/types/wms.types'

const region = (values: string[]): FilterByAttribute => ({
  attributeName: 'DCSMM_SOUS_REGION',
  matchType: 'equals',
  values,
})
const theme = (values: string[]): FilterByAttribute => ({
  attributeName: 'THEME',
  matchType: 'equals',
  values,
})

const eq = (field: string, value: string) =>
  `<PropertyIsEqualTo><PropertyName>${field}</PropertyName><Literal>${value}</Literal></PropertyIsEqualTo>`

describe('buildFilterBody', () => {
  it('returns null when nothing is selected', () => {
    expect(buildFilterBody([])).toBeNull()
    expect(buildFilterBody([region([])])).toBeNull()
    expect(buildFilterBody([region([''])])).toBeNull()
  })

  it('builds a single PropertyIsEqualTo for an equals attribute', () => {
    expect(buildFilterBody([region(['Manche'])])).toBe(eq('DCSMM_SOUS_REGION', 'Manche'))
  })

  it('wraps several values of one attribute in <Or>', () => {
    expect(buildFilterBody([region(['A', 'B'])])).toBe(
      `<Or>${eq('DCSMM_SOUS_REGION', 'A')}${eq('DCSMM_SOUS_REGION', 'B')}</Or>`,
    )
  })

  it('AND-combines several attributes', () => {
    expect(buildFilterBody([region(['A']), theme(['M'])])).toBe(
      `<And>${eq('DCSMM_SOUS_REGION', 'A')}${eq('THEME', 'M')}</And>`,
    )
  })

  it('XML-escapes the attribute name and values', () => {
    const field: FilterByAttribute = {
      attributeName: 'A&B',
      matchType: 'equals',
      values: [`a<'&"`],
    }
    expect(buildFilterBody([field])).toBe(eq('A&amp;B', 'a&lt;&apos;&amp;&quot;'))
  })

  it('throws for unsupported match types', () => {
    const field: FilterByAttribute = {
      attributeName: 'THEME',
      matchType: 'contains',
      values: ['x'],
    }
    expect(() => buildFilterBody([field])).toThrow(/contains/)
  })
})

describe('buildWmsFilterParam', () => {
  it('returns null without selections', () => {
    expect(buildWmsFilterParam('a,b', [region([])])).toBeNull()
  })

  it('wraps a single-sublayer filter in one <Filter>', () => {
    expect(buildWmsFilterParam('surval_point', [region(['A'])])).toBe(
      `<Filter>${eq('DCSMM_SOUS_REGION', 'A')}</Filter>`,
    )
  })

  it('emits one parenthesised <Filter> per sublayer (trimmed)', () => {
    const group = `(<Filter>${eq('DCSMM_SOUS_REGION', 'A')}</Filter>)`
    expect(buildWmsFilterParam('a, b ,c', [region(['A'])])).toBe(group + group + group)
  })
})
