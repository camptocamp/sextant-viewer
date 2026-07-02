import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { buildFieldFilter, discoverFields, fetchCount, fetchFieldValues } from './attributeIndex'
import type { IndexField } from './attributeIndex.types'
import type { GeoNetworkIndexConnection } from '@/types/wms.types'

const index: GeoNetworkIndexConnection = { url: 'https://host/es', featureTypeIds: ['ft1'] }
const field: IndexField = {
  esField: 'THEME',
  label: 'Thème',
  aggField: 'ft_THEME_s',
  type: 'terms',
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

describe('buildFieldFilter', () => {
  it('builds a terms clause for equals filters', () => {
    expect(
      buildFieldFilter({ attributeName: 'REGION', matchType: 'equals', values: ['A', 'B'] }),
    ).toEqual({ terms: { ft_REGION_s: ['A', 'B'] } })
  })

  it('throws for unsupported match types', () => {
    expect(() =>
      buildFieldFilter({ attributeName: 'THEME', matchType: 'contains', values: ['x'] }),
    ).toThrow(/contains/)
  })
})

describe('fetchFieldValues', () => {
  it('POSTs a terms aggregation to the index endpoint', async () => {
    const fetchMock = mockFetch({
      aggregations: { values: { buckets: [], sum_other_doc_count: 0 } },
    })

    await fetchFieldValues(index, field)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // POSTed to the endpoint as-is, no `/_search` suffix.
    expect(url).toBe('https://host/es')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      size: 0,
      query: { terms: { featureTypeId: ['ft1'] } },
      aggs: { values: { terms: { field: 'ft_THEME_s', size: 51 } } },
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

    expect(await fetchFieldValues(index, field)).toEqual({
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

    const result = await fetchFieldValues(index, field)
    expect(result.truncated).toBe(true)
    expect(result.values).toHaveLength(50)
    expect(result.values[0]).toEqual({ value: 'v0', count: 51 })
  })

  it('combines the feature type and active filters under a single bool', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues(index, field, [
      { attributeName: 'REGION', matchType: 'equals', values: ['Manche'] },
    ])
    expect(bodyOf(fetchMock).query).toEqual({
      bool: {
        filter: [{ terms: { featureTypeId: ['ft1'] } }, { terms: { ft_REGION_s: ['Manche'] } }],
      },
    })
  })

  it('throws when ElasticSearch responds with an error status', async () => {
    mockFetch({}, false, 503)
    await expect(fetchFieldValues(index, field)).rejects.toThrow(/503/)
  })
})

describe('fetchCount', () => {
  it('requests an accurate total and reads `hits.total.value`', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 4231 } } })

    expect(await fetchCount(index)).toBe(4231)
    expect(bodyOf(fetchMock)).toEqual({
      size: 0,
      track_total_hits: true,
      query: { terms: { featureTypeId: ['ft1'] } },
    })
  })

  it('reads a numeric `hits.total` (legacy ES response shape)', async () => {
    mockFetch({ hits: { total: 17 } })
    expect(await fetchCount(index)).toBe(17)
  })

  it('returns 0 when no total is present', async () => {
    mockFetch({ hits: {} })
    expect(await fetchCount(index)).toBe(0)
  })

  it('scopes the count by feature type and active filters', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 0 } } })

    await fetchCount(index, [{ attributeName: 'REGION', matchType: 'equals', values: ['Manche'] }])
    expect(bodyOf(fetchMock).query).toEqual({
      bool: {
        filter: [{ terms: { featureTypeId: ['ft1'] } }, { terms: { ft_REGION_s: ['Manche'] } }],
      },
    })
  })
})

describe('discoverFields', () => {
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

    expect(await discoverFields(index)).toEqual([
      { esField: 'THEME', label: 'THEME', aggField: 'ft_THEME_s', type: 'terms' },
      {
        esField: 'DCSMM_SOUS_REGION',
        label: 'DCSMM_SOUS_REGION',
        aggField: 'ft_DCSMM_SOUS_REGION_s',
        type: 'terms',
      },
    ])
    // size:1 sample search against the endpoint, no `/_search` suffix.
    expect(urlOf(fetchMock)).toBe('https://host/es')
    expect(bodyOf(fetchMock)).toEqual({
      size: 1,
      query: { terms: { featureTypeId: ['ft1'] } },
    })
  })

  it('returns an empty list when the sample document has no filterable column', async () => {
    mockFetch({
      hits: { hits: [{ _source: { geom: {}, featureTypeId: 'x' } }] },
    })
    expect(await discoverFields(index)).toEqual([])
  })

  it('returns an empty list when there is no sample document', async () => {
    mockFetch({ hits: { hits: [] } })
    expect(await discoverFields(index)).toEqual([])
  })
})
