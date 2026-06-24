import { describe, expect, it } from 'vitest'
import { buildFilterBody, buildWmsFilterParam } from './wmsFilter'
import type { AttributeFieldConfig } from '@/geonetwork/attributeIndex.types'

const region: AttributeFieldConfig = {
  esField: 'DCSMM_SOUS_REGION',
  label: 'Sous-région',
  aggField: 'ft_DCSMM_SOUS_REGION_s',
}
const theme: AttributeFieldConfig = {
  esField: 'THEME',
  label: 'Thème',
  aggField: 'ft_THEME_s',
  match: 'contains',
}

const eq = (field: string, value: string) =>
  `<PropertyIsEqualTo><PropertyName>${field}</PropertyName><Literal>${value}</Literal></PropertyIsEqualTo>`
const like = (field: string, value: string) =>
  `<PropertyIsLike wildCard="%" singleChar="_" escapeChar="!"><PropertyName>${field}</PropertyName><Literal>${value}</Literal></PropertyIsLike>`

describe('buildFilterBody', () => {
  it('returns null when nothing is selected', () => {
    expect(buildFilterBody({}, [region])).toBeNull()
    expect(buildFilterBody({ DCSMM_SOUS_REGION: [] }, [region])).toBeNull()
  })

  it('builds a single PropertyIsEqualTo for an equals field', () => {
    expect(buildFilterBody({ DCSMM_SOUS_REGION: ['Manche'] }, [region])).toBe(
      eq('DCSMM_SOUS_REGION', 'Manche'),
    )
  })

  it('wraps several values of one field in <Or>', () => {
    expect(buildFilterBody({ DCSMM_SOUS_REGION: ['A', 'B'] }, [region])).toBe(
      `<Or>${eq('DCSMM_SOUS_REGION', 'A')}${eq('DCSMM_SOUS_REGION', 'B')}</Or>`,
    )
  })

  it('uses PropertyIsLike for contains fields', () => {
    expect(buildFilterBody({ THEME: ['Microbiologie'] }, [theme])).toBe(
      like('THEME', '%Microbiologie%'),
    )
  })

  it('AND-combines several fields', () => {
    expect(buildFilterBody({ DCSMM_SOUS_REGION: ['A'], THEME: ['M'] }, [region, theme])).toBe(
      `<And>${eq('DCSMM_SOUS_REGION', 'A')}${like('THEME', '%M%')}</And>`,
    )
  })

  it('XML-escapes the field name and values', () => {
    const field: AttributeFieldConfig = { esField: 'A&B', label: 'x', aggField: 'ft_A_B_s' }
    expect(buildFilterBody({ 'A&B': [`a<'&"`] }, [field])).toBe(
      eq('A&amp;B', 'a&lt;&apos;&amp;&quot;'),
    )
  })

  it('escapes LIKE wildcards in contains literals', () => {
    expect(buildFilterBody({ THEME: ['50%_!x'] }, [theme])).toBe(like('THEME', '%50!%!_!!x%'))
  })
})

describe('buildWmsFilterParam', () => {
  it('returns null without selections', () => {
    expect(buildWmsFilterParam('a,b', {}, [region])).toBeNull()
  })

  it('wraps a single-sublayer filter in one <Filter>', () => {
    expect(buildWmsFilterParam('surval_point', { DCSMM_SOUS_REGION: ['A'] }, [region])).toBe(
      `<Filter>${eq('DCSMM_SOUS_REGION', 'A')}</Filter>`,
    )
  })

  it('emits one parenthesised <Filter> per sublayer (trimmed)', () => {
    const group = `(<Filter>${eq('DCSMM_SOUS_REGION', 'A')}</Filter>)`
    expect(buildWmsFilterParam('a, b ,c', { DCSMM_SOUS_REGION: ['A'] }, [region])).toBe(
      group + group + group,
    )
  })
})
