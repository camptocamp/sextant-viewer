import { describe, expect, it } from 'vitest'
import { buildOgcFilter, buildWmsFilterParam } from './wms.utils'
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

const NS = 'http://www.opengis.net/ogc'
const filterXml = (body: string) => `<Filter xmlns="${NS}">${body}</Filter>`
const eq = (field: string, value: string) =>
  `<PropertyIsEqualTo><PropertyName>${field}</PropertyName><Literal>${value}</Literal></PropertyIsEqualTo>`

describe('buildOgcFilter', () => {
  it('returns null when nothing is selected', () => {
    expect(buildOgcFilter([])).toBeNull()
    expect(buildOgcFilter([region([])])).toBeNull()
    expect(buildOgcFilter([region([''])])).toBeNull()
  })

  it('throws for unsupported match types', () => {
    const field: FilterByAttribute = {
      attributeName: 'THEME',
      matchType: 'contains',
      values: ['x'],
    }
    expect(() => buildOgcFilter([field])).toThrow(/contains/)
  })
})

describe('buildWmsFilterParam', () => {
  it('returns null without selections', () => {
    expect(buildWmsFilterParam('a,b', [region([])])).toBeNull()
  })

  it('builds a single PropertyIsEqualTo for an equals attribute', () => {
    expect(buildWmsFilterParam('surval_point', [region(['Manche'])])).toBe(
      filterXml(eq('DCSMM_SOUS_REGION', 'Manche')),
    )
  })

  it('wraps several values of one attribute in <Or>', () => {
    expect(buildWmsFilterParam('surval_point', [region(['A', 'B'])])).toBe(
      filterXml(`<Or>${eq('DCSMM_SOUS_REGION', 'A')}${eq('DCSMM_SOUS_REGION', 'B')}</Or>`),
    )
  })

  it('AND-combines several attributes', () => {
    expect(buildWmsFilterParam('surval_point', [region(['A']), theme(['M'])])).toBe(
      filterXml(`<And>${eq('DCSMM_SOUS_REGION', 'A')}${eq('THEME', 'M')}</And>`),
    )
  })

  it('XML-escapes the attribute name and values (via CDATA)', () => {
    const field: FilterByAttribute = {
      attributeName: 'A&B',
      matchType: 'equals',
      values: [`a<'&"`],
    }
    expect(buildWmsFilterParam('surval_point', [field])).toBe(
      filterXml(
        `<PropertyIsEqualTo><PropertyName><![CDATA[A&B]]></PropertyName>` +
          `<Literal><![CDATA[a<'&"]]></Literal></PropertyIsEqualTo>`,
      ),
    )
  })

  it('emits one parenthesised <Filter> per sublayer (trimmed)', () => {
    const group = `(${filterXml(eq('DCSMM_SOUS_REGION', 'A'))})`
    expect(buildWmsFilterParam('a, b ,c', [region(['A'])])).toBe(group + group + group)
  })
})
