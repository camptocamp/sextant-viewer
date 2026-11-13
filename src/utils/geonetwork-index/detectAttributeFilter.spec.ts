import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveRecordRef: vi.fn(),
  fetchRecordResources: vi.fn(),
  probeIndex: vi.fn(),
  getFeatureTypeFull: vi.fn(),
}))

vi.mock('./recordRef', () => ({ resolveRecordRef: mocks.resolveRecordRef }))
vi.mock('./gnRecord', () => ({ fetchRecordResources: mocks.fetchRecordResources }))
vi.mock('./attributeIndex', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./attributeIndex')>()),
  probeIndex: mocks.probeIndex,
}))
vi.mock('@camptocamp/ogc-client', () => ({
  WfsEndpoint: class {
    isReady() {
      return Promise.resolve(this)
    }
    getFeatureTypeFull = mocks.getFeatureTypeFull
  },
}))

import { gnBaseFromEsUrl, profileToFields, resolveAttributeFilter } from './detectAttributeFilter'
import type { MapLayer } from '../layer.utils'

describe('resolveAttributeFilter', () => {
  const layer = { type: 'wms', url: 'https://host/wms', name: 'ws:surval_point' } as MapLayer
  const dataSources = [{ type: 'geonetwork-index', url: 'https://host/geonetwork/index/features' }]

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.resolveRecordRef.mockResolvedValue({ uuid: 'uuid' })
    mocks.fetchRecordResources.mockResolvedValue({
      wfs: [{ wfsUrl: 'https://host/wfs', name: 'surval_point', featureTypes: ['surval_point'] }],
      wps: [],
    })
    mocks.probeIndex.mockResolvedValue({
      total: 3,
      sampleSource: { ft_THEME_s: 'x', geom: { type: 'Point', coordinates: [0, 0] } },
    })
    mocks.getFeatureTypeFull.mockReset()
    mocks.getFeatureTypeFull.mockResolvedValue({ name: 'surval_point', geometryName: 'geometry' })
  })

  it('reads the WFS geometry property of the matched feature type when geometries are indexed', async () => {
    const connection = await resolveAttributeFilter(layer, dataSources as never)
    expect(mocks.getFeatureTypeFull).toHaveBeenCalledWith('surval_point')
    expect(connection?.geometryName).toBe('geometry')
  })

  it('does not query the WFS when the index holds no geometry', async () => {
    mocks.probeIndex.mockResolvedValue({ total: 3, sampleSource: { ft_THEME_s: 'x' } })
    const connection = await resolveAttributeFilter(layer, dataSources as never)
    expect(mocks.getFeatureTypeFull).not.toHaveBeenCalled()
    expect(connection).toBeDefined()
    expect(connection).not.toHaveProperty('geometryName')
  })

  it('keeps the other filters when the WFS cannot tell the geometry property', async () => {
    mocks.getFeatureTypeFull.mockRejectedValue(new Error('WFS down'))
    const connection = await resolveAttributeFilter(layer, dataSources as never)
    expect(connection?.fields).toHaveLength(1)
    expect(connection).not.toHaveProperty('geometryName')
  })
})

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
      }),
    ).toEqual([
      expect.objectContaining({ esField: 'THEME', matchType: 'contains' }),
      expect.objectContaining({ esField: 'REGION', matchType: 'equals' }),
    ])
  })

  it('drops hidden columns', () => {
    expect(profileToFields({ fields: [{ name: 'A', hidden: true }, { name: 'C' }] })).toEqual([
      { esField: 'C', label: 'C', aggField: 'ft_C_s', type: 'terms', matchType: 'equals' },
    ])
  })

  it('maps tree and rangeDate columns, as in the Surval profile', () => {
    expect(
      profileToFields({
        tokenizedFields: { THEME: ';', PARAMETRE: ';' },
        fields: [
          { name: 'PARAMETRE', label: { fr: 'Paramètre' } },
          {
            name: 'range_Date',
            type: 'rangeDate',
            minField: 'DATEMIN',
            maxField: 'DATEMAX',
            label: { fr: 'Date' },
            display: 'graph',
          },
        ],
        treeFields: ['PARAMETRE'],
      }),
    ).toEqual([
      {
        esField: 'PARAMETRE',
        label: 'Paramètre',
        aggField: 'ft_PARAMETRE_s_tree',
        type: 'tree',
        tokenSeparator: ';',
      },
      {
        esField: 'range_Date',
        label: 'Date',
        type: 'dateRange',
        minField: 'DATEMIN',
        maxField: 'DATEMAX',
      },
    ])
  })

  it('skips a rangeDate column missing its min or max field', () => {
    expect(
      profileToFields({ fields: [{ name: 'D', type: 'rangeDate', minField: 'MIN' }] }),
    ).toEqual([])
  })
})
