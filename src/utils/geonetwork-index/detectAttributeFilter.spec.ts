import { describe, expect, it } from 'vitest'
import { gnBaseFromEsUrl, profileToFields } from './detectAttributeFilter'

describe('gnBaseFromEsUrl', () => {
  it('strips the features-index suffix', () => {
    expect(gnBaseFromEsUrl('https://host/geonetwork/index/features')).toBe(
      'https://host/geonetwork',
    )
    expect(gnBaseFromEsUrl('https://host/geonetwork/index/features/')).toBe(
      'https://host/geonetwork',
    )
  })

  it('leaves a url without the suffix untouched', () => {
    expect(gnBaseFromEsUrl('https://host/geonetwork')).toBe('https://host/geonetwork')
  })
})

describe('profileToFields', () => {
  it('keeps visible value-list columns with FR labels and the ft_<COLUMN>_s aggField', () => {
    expect(
      profileToFields({
        fields: [
          { name: 'THEME', label: { fr: 'Thème', en: 'Theme' } },
          { name: 'REGION', label: { en: 'Region' } },
        ],
      }),
    ).toEqual([
      {
        esField: 'THEME',
        label: 'Thème',
        aggField: 'ft_THEME_s',
        type: 'terms',
        matchType: 'equals',
      },
      {
        esField: 'REGION',
        label: 'Region',
        aggField: 'ft_REGION_s',
        type: 'terms',
        matchType: 'equals',
      },
    ])
  })

  it('marks tokenized columns as contains', () => {
    expect(
      profileToFields({
        tokenizedFields: { THEME: ';' },
        fields: [{ name: 'THEME' }, { name: 'REGION' }],
      }).map(({ esField, matchType }) => ({ esField, matchType })),
    ).toEqual([
      { esField: 'THEME', matchType: 'contains' },
      { esField: 'REGION', matchType: 'equals' },
    ])
  })

  it('drops hidden, rangeDate and tree columns', () => {
    expect(
      profileToFields({
        fields: [
          { name: 'A', hidden: true },
          { name: 'B', type: 'rangeDate' },
          { name: 'C' },
          { name: 'D' },
        ],
        treeFields: ['D'],
      }),
    ).toEqual([
      { esField: 'C', label: 'C', aggField: 'ft_C_s', type: 'terms', matchType: 'equals' },
    ])
  })
})
