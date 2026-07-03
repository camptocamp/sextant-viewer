import { describe, expect, it } from 'vitest'
import { gnBaseFromEsUrl, parseUuid, profileToFields } from './index'

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

describe('parseUuid', () => {
  it('reads a `uuid` query param', () => {
    expect(parseUuid('https://host/geonetwork/srv/api/records?uuid=abc-1')).toBe('abc-1')
  })

  it('falls back to the `id` query param', () => {
    expect(parseUuid('https://host/geonetwork/srv/records?id=abc-2')).toBe('abc-2')
  })

  it('reads the `#/metadata/<uuid>` fragment form', () => {
    expect(parseUuid('https://host/geonetwork/#/metadata/abc-3')).toBe('abc-3')
  })

  it('reads case-variant CSW params (ID=, Uuid=)', () => {
    expect(parseUuid('https://host/srv/fre/csw?request=GetRecordById&ID=abc-4')).toBe('abc-4')
    expect(parseUuid('https://host/srv/csw?Uuid=abc-5')).toBe('abc-5')
  })

  it('reads the GN REST path form `…/records/<uuid>`', () => {
    expect(parseUuid('https://host/geonetwork/srv/api/records/abc-6')).toBe('abc-6')
    expect(parseUuid('https://host/geonetwork/srv/api/records/abc-7/formatters/xml')).toBe('abc-7')
  })

  it('returns null when no uuid is present', () => {
    expect(parseUuid('https://host/geonetwork/srv/search')).toBeNull()
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
