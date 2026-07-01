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

  it('returns null when no uuid is present', () => {
    expect(parseUuid('https://host/geonetwork/srv/records')).toBeNull()
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
      { esField: 'THEME', label: 'Thème', aggField: 'ft_THEME_s', type: 'terms' },
      { esField: 'REGION', label: 'Region', aggField: 'ft_REGION_s', type: 'terms' },
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
    ).toEqual([{ esField: 'C', label: 'C', aggField: 'ft_C_s', type: 'terms' }])
  })
})
