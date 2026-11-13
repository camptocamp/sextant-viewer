import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  buildFieldFilter,
  fetchCount,
  fetchDateBounds,
  fetchExtent,
  fetchFieldValues,
  fetchTreeValues,
  fieldsFromSource,
  hasGeometry,
  probeIndex,
} from './attributeIndex'
import type { DateRangeIndexField, IndexField, TreeIndexField } from './attributeIndex.types'
import type { GeoNetworkIndexConnection } from '@/types/wms.types'

const index: GeoNetworkIndexConnection = { url: 'https://host/es', featureTypeIds: ['ft1'] }
const field: IndexField = {
  esField: 'THEME',
  label: 'Thème',
  aggField: 'ft_THEME_s',
  type: 'terms',
  matchType: 'equals',
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

  it('filters contains (tokenized) attributes by exact token too', () => {
    expect(
      buildFieldFilter({ attributeName: 'THEME', matchType: 'contains', values: ['Benthos'] }),
    ).toEqual({ terms: { ft_THEME_s: ['Benthos'] } })
  })

  it('filters tree paths on the path-tokenized field, which covers their descendants', () => {
    expect(
      buildFieldFilter({ attributeName: 'PARAMETRE', matchType: 'tree', values: ['A/B'] }),
    ).toEqual({ terms: { ft_PARAMETRE_s_tree: ['A/B'] } })
  })

  it('filters a date range by period overlap, up to the end of its last day', () => {
    expect(
      buildFieldFilter({
        kind: 'dateRange',
        attributeName: 'range_Date',
        minField: 'DATEMIN',
        maxField: 'DATEMAX',
        from: '2020-01-01',
        to: '2020-01-31',
      }),
    ).toEqual({
      bool: {
        filter: [
          { range: { ft_DATEMIN_dt: { lt: '2020-02-01', format: 'yyyy-MM-dd' } } },
          { range: { ft_DATEMAX_dt: { gte: '2020-01-01', format: 'yyyy-MM-dd' } } },
        ],
      },
    })
  })

  it('filters an area by geometry intersection, as an envelope clamped to the globe', () => {
    expect(
      buildFieldFilter({ kind: 'bbox', geometryName: 'geometry', extent: [-200, 48, -4, 95] }),
    ).toEqual({
      geo_shape: {
        geom: {
          shape: {
            type: 'envelope',
            coordinates: [
              [-180, 90],
              [-4, 48],
            ],
          },
          relation: 'intersects',
        },
      },
    })
  })
})

describe('fetchTreeValues', () => {
  const tree: TreeIndexField = {
    esField: 'PARAMETRE',
    label: 'Paramètre',
    aggField: 'ft_PARAMETRE_s_tree',
    type: 'tree',
  }
  const termsAgg = (fetchMock: Mock) => bodyOf(fetchMock).aggs.values.terms

  it('loads the root level and one level ahead', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })
    await fetchTreeValues(index, tree, [], {})
    expect(termsAgg(fetchMock)).toEqual({
      field: 'ft_PARAMETRE_s_tree',
      size: 1001,
      include: '[^/]+(/[^/]+)?',
    })
  })

  it('adds the level below each expanded path, escaping regex characters', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })
    await fetchTreeValues(index, tree, [], { expanded: ['A', 'A/B (x)'] })
    expect(termsAgg(fetchMock).include).toBe('[^/]+(/[^/]+)?|A/[^/]+/[^/]+|A/B \\(x\\)/[^/]+/[^/]+')
  })

  it('searches the last level of any path, case-insensitively and capped like a list', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })
    await fetchTreeValues(index, tree, [], { expanded: ['A'], search: ' Coli ' })
    expect(termsAgg(fetchMock)).toEqual({
      field: 'ft_PARAMETRE_s_tree',
      size: 51,
      include: '(.*/)?[^/]*[cC][oO][lL][iI][^/]*',
    })
  })

  it('maps the buckets like a values list', async () => {
    mockFetch({ aggregations: { values: { buckets: [{ key: 'A/B', doc_count: 3 }] } } })
    expect(await fetchTreeValues(index, tree, [], {})).toEqual({
      esField: 'PARAMETRE',
      values: [{ value: 'A/B', count: 3 }],
      truncated: false,
    })
  })
})

describe('fetchDateBounds', () => {
  const range: DateRangeIndexField = {
    esField: 'range_Date',
    label: 'Date',
    type: 'dateRange',
    minField: 'DATEMIN',
    maxField: 'DATEMAX',
  }

  it('reads the earliest start and latest end over the whole layer', async () => {
    const fetchMock = mockFetch({
      aggregations: {
        dateMin: { value: 109209600000, value_as_string: '1973-06-18' },
        dateMax: { value: 1793795580000, value_as_string: '2026-11-04' },
      },
    })
    expect(await fetchDateBounds(index, range)).toEqual({ min: '1973-06-18', max: '2026-11-04' })
    expect(bodyOf(fetchMock)).toEqual({
      size: 0,
      query: { terms: { featureTypeId: ['ft1'] } },
      aggs: {
        dateMin: { min: { field: 'ft_DATEMIN_dt', format: 'yyyy-MM-dd' } },
        dateMax: { max: { field: 'ft_DATEMAX_dt', format: 'yyyy-MM-dd' } },
      },
    })
  })

  it('returns null when no feature has a period', async () => {
    mockFetch({ aggregations: { dateMin: { value: null }, dateMax: { value: null } } })
    expect(await fetchDateBounds(index, range)).toBeNull()
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

  it('omits `include` for a blank search', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues(index, field, [], undefined, '   ')
    expect(bodyOf(fetchMock).aggs.values.terms).not.toHaveProperty('include')
  })

  it('restricts buckets to a case-insensitive contains pattern', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues(index, field, [], undefined, ' Bé2 ')
    expect(bodyOf(fetchMock).aggs.values.terms.include).toBe('.*[bB][éÉ]2.*')
  })

  it('escapes Lucene regex reserved characters in the search', async () => {
    const fetchMock = mockFetch({ aggregations: { values: { buckets: [] } } })

    await fetchFieldValues(index, field, [], undefined, 'a.b(c')
    expect(bodyOf(fetchMock).aggs.values.terms.include).toBe('.*[aA]\\.[bB]\\([cC].*')
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

  it('forwards an AbortSignal to fetch', async () => {
    const fetchMock = mockFetch({ hits: { total: { value: 0 } } })
    const signal = new AbortController().signal

    await fetchCount(index, [], signal)
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal).toBe(signal)
  })
})

const bboxAggs = (xmin: number | null, ymin: number | null, xmax: number, ymax: number) => ({
  aggregations: {
    xmin: { value: xmin },
    ymin: { value: ymin },
    xmax: { value: xmax },
    ymax: { value: ymax },
  },
})

describe('fetchExtent', () => {
  it('aggregates the bbox fields of the filtered documents', async () => {
    const fetchMock = mockFetch(bboxAggs(-5, 43, 8, 51))

    expect(
      await fetchExtent(index, [{ attributeName: 'REGION', matchType: 'equals', values: ['A'] }]),
    ).toEqual([-5, 43, 8, 51])
    expect(bodyOf(fetchMock)).toEqual({
      size: 0,
      query: {
        bool: {
          filter: [{ terms: { featureTypeId: ['ft1'] } }, { terms: { ft_REGION_s: ['A'] } }],
        },
      },
      aggs: {
        xmin: { min: { field: 'bbox_xmin' } },
        ymin: { min: { field: 'bbox_ymin' } },
        xmax: { max: { field: 'bbox_xmax' } },
        ymax: { max: { field: 'bbox_ymax' } },
      },
    })
  })

  it('keeps a coordinate equal to 0', async () => {
    mockFetch(bboxAggs(0, 0, 8, 51))
    expect(await fetchExtent(index)).toEqual([0, 0, 8, 51])
  })

  it('buffers a single point so the map does not zoom to the maximum', async () => {
    mockFetch(bboxAggs(2, 48, 2, 48))
    expect(await fetchExtent(index)).toEqual([1.95, 47.95, 2.05, 48.05])
  })

  it('returns null when no document matched', async () => {
    mockFetch(bboxAggs(null, null, 0, 0))
    expect(await fetchExtent(index)).toBeNull()
  })

  it('returns null when the response has no bbox aggregations', async () => {
    mockFetch({})
    expect(await fetchExtent(index)).toBeNull()
  })
})

describe('fieldsFromSource', () => {
  it('discovers `ft_<COLUMN>_s` and `ft_<COLUMN>_s_tree` columns from a sample document', () => {
    expect(
      fieldsFromSource({
        ft_THEME_s: 'Microbiologie',
        ft_DCSMM_SOUS_REGION_s: 'Manche',
        ft_DATE_dt: '2020-01-01',
        ft_REGION_s_tree: 'a/b',
        geom: {},
        featureTypeId: 'https%3A%2F%2Fhost%2Fwfs%23layer',
      }),
    ).toEqual([
      {
        esField: 'THEME',
        label: 'THEME',
        aggField: 'ft_THEME_s',
        type: 'terms',
        matchType: 'equals',
      },
      {
        esField: 'DCSMM_SOUS_REGION',
        label: 'DCSMM_SOUS_REGION',
        aggField: 'ft_DCSMM_SOUS_REGION_s',
        type: 'terms',
        matchType: 'equals',
      },
      { esField: 'REGION', label: 'REGION', aggField: 'ft_REGION_s_tree', type: 'tree' },
    ])
  })

  it('tells whether the sample document carries the feature geometry', () => {
    expect(hasGeometry({ geom: { type: 'Point', coordinates: [0, 0] } })).toBe(true)
    expect(hasGeometry({ ft_THEME_s: 'x' })).toBe(false)
  })

  it('returns an empty list when the sample document has no filterable column', () => {
    expect(fieldsFromSource({ geom: {}, featureTypeId: 'x' })).toEqual([])
  })
})

describe('probeIndex', () => {
  it('fetches the total and a sample source in one size:1 track_total_hits search', async () => {
    const fetchMock = mockFetch({
      hits: {
        total: { value: 8641 },
        hits: [{ _source: { ft_THEME_s: 'Microbiologie', geom: {} } }],
      },
    })

    expect(await probeIndex(index)).toEqual({
      total: 8641,
      sampleSource: { ft_THEME_s: 'Microbiologie', geom: {} },
    })
    // Single sample+count search against the endpoint, no `/_search` suffix.
    expect(urlOf(fetchMock)).toBe('https://host/es')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bodyOf(fetchMock)).toEqual({
      size: 1,
      track_total_hits: true,
      query: { terms: { featureTypeId: ['ft1'] } },
    })
  })

  it('returns total 0 and an empty source when the index has no matching document', async () => {
    mockFetch({ hits: { total: { value: 0 }, hits: [] } })
    expect(await probeIndex(index)).toEqual({ total: 0, sampleSource: {} })
  })
})
