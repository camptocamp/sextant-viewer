import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  buildFieldFilter,
  discoverFields,
  fetchCount,
  fetchFieldValues,
  isLayerIndexed,
} from './attributeIndex'
import type { AttributeFieldConfig, GeonetworkSource } from './attributeIndex.types'

const es: GeonetworkSource = { url: 'https://host/es' }
const field: AttributeFieldConfig = {
  esField: 'THEME',
  label: 'Thème',
  aggField: 'THEME.keyword',
}

let originalFetch: typeof globalThis.fetch

function mockFetch(json: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: 'Service Unavailable',
    json: () => Promise.resolve(json),
  })
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  return fetchMock
}

const urlOf = (fetchMock: Mock, call = 0) => fetchMock.mock.calls[call]![0] as string

const bodyOf = (fetchMock: Mock, call = 0) =>
  JSON.parse((fetchMock.mock.calls[call]![1] as RequestInit).body as string)

beforeEach(() => {
  originalFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('isLayerIndexed', () => {
  it('queries the harvesterReport doc and returns true when at least one hit', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 1 } } })

    const wfsUrl = 'https://sextant.ifremer.fr/services/wfs/environnement_marin'
    const docId = `${wfsUrl}#surval_parametre_point,surval_parametre_ligne`
    expect(await isLayerIndexed({ url: '/geonetwork/srv/index/_search' }, docId)).toBe(true)

    expect(urlOf(fetchMock)).toBe('/geonetwork/srv/index/_search')
    expect(bodyOf(fetchMock)).toEqual({
      size: 0,
      track_total_hits: true,
      query: {
        bool: {
          filter: [
            { term: { id: encodeURIComponent(docId) } },
            { term: { docType: 'harvesterReport' } },
          ],
        },
      },
    })
  })

  it('returns false when there are no hits', async () => {
    mockFetch({ hits: { total: { value: 0 } } })
    expect(await isLayerIndexed(es, 'http://wfs#layer')).toBe(false)
  })

  it('reads a legacy numeric `hits.total`', async () => {
    mockFetch({ hits: { total: 2 } })
    expect(await isLayerIndexed(es, 'http://wfs#layer')).toBe(true)
  })
})

describe('fetchFieldValues', () => {
  it('POSTs a terms aggregation to the index endpoint', async () => {
    const fetchMock = mockFetch({
      aggregations: { values: { buckets: [], sum_other_doc_count: 0 } },
    })

    await fetchFieldValues(es, field)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // POSTed to the endpoint as-is, no `/_search` suffix.
    expect(url).toBe('https://host/es')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      size: 0,
      aggs: { values: { terms: { field: 'THEME.keyword', size: 51 } } },
    })
  })

  it('maps buckets to values/counts without flagging truncation when under the cap', async () => {
    mockFetch({
      aggregations: {
        values: {
          buckets: [
            { key: 'A', doc_count: 12 },
            { key: 'B', doc_count: 3 },
          ],
          sum_other_doc_count: 5,
        },
      },
    })

    expect(await fetchFieldValues(es, field)).toEqual({
      esField: 'THEME',
      values: [
        { value: 'A', count: 12 },
        { value: 'B', count: 3 },
      ],
      truncated: false,
    })
  })

  it('flags truncation and drops the extra bucket when more than the cap exist', async () => {
    // One bucket past the cap: the cap is dropped from the values and `truncated` is set.
    const buckets = Array.from({ length: 51 }, (_, i) => ({ key: `v${i}`, doc_count: 51 - i }))
    mockFetch({ aggregations: { values: { buckets } } })

    const result = await fetchFieldValues(es, field)
    expect(result.truncated).toBe(true)
    expect(result.values).toHaveLength(50)
    expect(result.values[0]).toEqual({ value: 'v0', count: 51 })
  })

  it('honours an explicit aggField', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues(es, { esField: 'p', label: 'P', aggField: 'p_raw' })

    expect(bodyOf(fetchMock).aggs.values.terms).toEqual({ field: 'p_raw', size: 51 })
  })

  it('scopes the aggregation by feature type when set', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues({ ...es, featureType: 'surval_point' }, field)
    expect(bodyOf(fetchMock).query).toEqual({
      term: { featureTypeId: 'surval_point' },
    })
  })

  it('combines the feature type and extra filters under a single bool', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues({ ...es, featureType: 'x' }, field, [{ term: { REGION: 'Manche' } }])
    expect(bodyOf(fetchMock).query).toEqual({
      bool: {
        filter: [{ term: { featureTypeId: 'x' } }, { term: { REGION: 'Manche' } }],
      },
    })
  })

  it('throws when ElasticSearch responds with an error status', async () => {
    mockFetch({}, false, 503)
    await expect(fetchFieldValues(es, field)).rejects.toThrow(/503/)
  })
})

describe('buildFieldFilter', () => {
  it('builds a terms clause for equals fields', () => {
    expect(
      buildFieldFilter({ esField: 'REGION', label: 'R', aggField: 'REGION.keyword' }, ['A', 'B']),
    ).toEqual({
      terms: { 'REGION.keyword': ['A', 'B'] },
    })
  })

  it('honours an explicit aggField', () => {
    expect(buildFieldFilter({ esField: 'r', label: 'R', aggField: 'ft_REGION_s' }, ['A'])).toEqual({
      terms: { ft_REGION_s: ['A'] },
    })
  })

  it('builds a wildcard should clause for contains fields', () => {
    expect(
      buildFieldFilter(
        { esField: 'THEME', label: 'T', aggField: 'THEME.keyword', match: 'contains' },
        ['micro', 'bio'],
      ),
    ).toEqual({
      bool: {
        should: [
          { wildcard: { 'THEME.keyword': '*micro*' } },
          { wildcard: { 'THEME.keyword': '*bio*' } },
        ],
        minimum_should_match: 1,
      },
    })
  })

  it('escapes ES wildcard metacharacters in contains values', () => {
    expect(
      buildFieldFilter(
        { esField: 'THEME', label: 'T', aggField: 'THEME.keyword', match: 'contains' },
        ['a*b?c\\d'],
      ),
    ).toEqual({
      bool: {
        should: [{ wildcard: { 'THEME.keyword': '*a\\*b\\?c\\\\d*' } }],
        minimum_should_match: 1,
      },
    })
  })
})

describe('fetchCount', () => {
  it('requests an accurate total and reads `hits.total.value`', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 4231 } } })

    expect(await fetchCount(es)).toBe(4231)
    expect(bodyOf(fetchMock)).toEqual({ size: 0, track_total_hits: true })
  })

  it('reads a numeric `hits.total` (legacy ES response shape)', async () => {
    mockFetch({ hits: { total: 17 } })
    expect(await fetchCount(es)).toBe(17)
  })

  it('returns 0 when no total is present', async () => {
    mockFetch({ hits: {} })
    expect(await fetchCount(es)).toBe(0)
  })

  it('scopes the count by feature type and filters', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 0 } } })

    await fetchCount({ ...es, featureType: 'x' }, [{ term: { REGION: 'Manche' } }])
    expect(bodyOf(fetchMock).query).toEqual({
      bool: {
        filter: [{ term: { featureTypeId: 'x' } }, { term: { REGION: 'Manche' } }],
      },
    })
  })
})

describe('discoverFields', () => {
  const src: GeonetworkSource = { url: 'https://host/es' }

  it('discovers `ft_<COLUMN>_s` columns from a sample document', async () => {
    const fetchMock = mockFetch({
      hits: {
        hits: [
          {
            _source: {
              ft_THEME_s: 'Microbiologie',
              ft_DCSMM_SOUS_REGION_s: 'Manche',
              ft_DATE_dt: '2020-01-01',
              ft_REGION_s_tree: 'a/b',
              geom: {},
              featureTypeId: 'https%3A%2F%2Fhost%2Fwfs%23layer',
            },
          },
        ],
      },
    })

    expect(await discoverFields(src)).toEqual([
      {
        esField: 'THEME',
        label: 'THEME',
        aggField: 'ft_THEME_s',
        match: 'equals',
      },
      {
        esField: 'DCSMM_SOUS_REGION',
        label: 'DCSMM_SOUS_REGION',
        aggField: 'ft_DCSMM_SOUS_REGION_s',
        match: 'equals',
      },
    ])
    // size:1 sample search against the endpoint, no `/_search` suffix.
    expect(urlOf(fetchMock)).toBe('https://host/es')
    expect(bodyOf(fetchMock)).toEqual({ size: 1 })
  })

  it('scopes the sample document to the feature type when set', async () => {
    const fetchMock = mockFetch({
      hits: { hits: [{ _source: { ft_THEME_s: 'x' } }] },
    })

    await discoverFields({
      url: '/geonetwork/index/features',
      featureType: 'k',
    })
    expect(urlOf(fetchMock)).toBe('/geonetwork/index/features')
    expect(bodyOf(fetchMock)).toEqual({
      size: 1,
      query: { term: { featureTypeId: 'k' } },
    })
  })

  it('returns an empty list when the sample document has no filterable column', async () => {
    mockFetch({
      hits: { hits: [{ _source: { geom: {}, featureTypeId: 'x' } }] },
    })
    expect(await discoverFields(src)).toEqual([])
  })

  it('returns an empty list when there is no sample document', async () => {
    mockFetch({ hits: { hits: [] } })
    expect(await discoverFields(src)).toEqual([])
  })
})
