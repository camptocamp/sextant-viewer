import type { Extent } from '@geospatial-sdk/core'
import type {
  IndexField,
  EsSearchResponse,
  FieldValue,
  DistinctFieldValues,
} from './attributeIndex.types'
import type {
  FilterByAttribute,
  GeoNetworkIndexConnection,
  WmsFilterState,
} from '@/types/wms.types'

// Maximum number of distinct attribute values to fetch for a column.
const DEFAULT_FIELD_VALUES_LIMIT = 50

// Each WFS attribute column is indexed as `ft_<COLUMN>_s` (keyword); other variants
// (`_s_tree`, `_dt`, …) are not value-list filterable.
const TERMS_FIELD_MATCH = /^ft_(.+)_s$/
const aggFieldName = (column: string) => `ft_${column}_s`

const LUCENE_REGEX_RESERVED = /[.?+*|{}[\]()"\\#@&<>~]/

/**
 * Lucene regex matching values that contain `term`, ignoring case: `include` regexes are
 * case-sensitive and have no flag, so each letter becomes a `[xX]` class.
 */
function containsPattern(term: string): string {
  const body = [...term]
    .map((char) => {
      const lower = char.toLowerCase()
      const upper = char.toUpperCase()
      // Skip classes for case mappings that change length (e.g. `ß` → `SS`).
      if (lower !== upper && lower.length === 1 && upper.length === 1) return `[${lower}${upper}]`
      return LUCENE_REGEX_RESERVED.test(char) ? `\\${char}` : char
    })
    .join('')
  return `.*${body}.*`
}

/** POST an ES query to the index URL (itself the search action; no `/_search` is appended). */
async function esSearch<T>(
  index: GeoNetworkIndexConnection,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(index.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw new Error(`ElasticSearch responded with ${response.status} (${response.statusText})`)
  }

  return response.json()
}

/** Read the total hit count from an ES search response, which may be a number or an object. */
function readTotal(response: EsSearchResponse): number {
  const total = response.hits?.total
  return typeof total === 'number' ? total : (total?.value ?? 0)
}

// Scope a search to the index's feature types and any active `filters`; the lone feature-type
// terms clause stays bare (no surrounding bool).
function filteredQuery(
  index: GeoNetworkIndexConnection,
  filters: WmsFilterState = [],
): Record<string, unknown> {
  const featureType = { terms: { featureTypeId: index.featureTypeIds } }
  return filters.length === 0
    ? featureType
    : { bool: { filter: [featureType, ...filters.map(buildFieldFilter)] } }
}

/**
 * Discover filterable columns from one sample document's `_source` (the index may expose no
 * public `_mapping`): every `ft_<COLUMN>_s` keyword field becomes a `terms` column on `<COLUMN>`.
 */
export function fieldsFromSource(source: Record<string, unknown>): IndexField[] {
  const fields: IndexField[] = []
  for (const key of Object.keys(source)) {
    // TODO: support other types of fields (value trees, date time...)

    const name = TERMS_FIELD_MATCH.exec(key)?.[1]
    if (!name) continue

    fields.push({ esField: name, label: name, aggField: key, type: 'terms', matchType: 'equals' })
  }

  return fields
}

/**
 * Single round-trip that both counts the index's matching documents and returns one sample
 * `_source` — the no-profile detection path needs the count (is this index the right one?) and a
 * sample document (to discover columns), so it fetches both at once instead of two searches.
 */
export async function probeIndex(
  index: GeoNetworkIndexConnection,
): Promise<{ total: number; sampleSource: Record<string, unknown> }> {
  const json = await esSearch<EsSearchResponse>(index, {
    size: 1,
    track_total_hits: true,
    query: filteredQuery(index),
  })
  return { total: readTotal(json), sampleSource: json.hits?.hits?.[0]?._source ?? {} }
}

/**
 * ES filter clause selecting the documents whose attribute matches any of the selected values.
 * Both match types filter by exact token: tokenized columns are indexed token-per-token, so
 * `contains` only changes the WFS-side comparison (see `wmsFilter.ts`).
 */
export function buildFieldFilter(filter: FilterByAttribute): Record<string, unknown> {
  return { terms: { [aggFieldName(filter.attributeName)]: filter.values } }
}

/**
 * Distinct values and counts of a column via a terms aggregation. `filters` (active selections)
 * narrow the counts to give faceted counts. Buckets come back ordered by descending count.
 * `search` keeps only the values containing it (case-insensitive); it filters buckets, not
 * documents, so a tokenized column doesn't bring back the other tokens of matching documents.
 */
export async function fetchFieldValues(
  index: GeoNetworkIndexConnection,
  field: IndexField,
  filters: WmsFilterState = [],
  signal?: AbortSignal,
  search = '',
): Promise<DistinctFieldValues> {
  // This has to be a 'terms' field; if not, no way to obtain distinct values
  if (field.type !== 'terms') {
    throw new Error(`Unsupported field type: ${field.type}`)
  }

  const size = DEFAULT_FIELD_VALUES_LIMIT
  const query = filteredQuery(index, filters)
  const term = search.trim()

  // Request one extra bucket so truncation is "more distinct values than the cap exist",
  // not ES's `sum_other_doc_count` which over-reports on multi-shard indices.
  const json = await esSearch<EsSearchResponse>(
    index,
    {
      size: 0,
      query,
      aggs: {
        values: {
          terms: {
            field: field.aggField,
            size: size + 1,
            ...(term && { include: containsPattern(term) }),
          },
        },
      },
    },
    signal,
  )

  const buckets = json.aggregations?.values?.buckets ?? []
  const values: FieldValue[] = buckets.slice(0, size).map((bucket) => ({
    value: String(bucket.key),
    count: bucket.doc_count,
  }))

  return {
    esField: field.esField,
    values,
    truncated: buckets.length > size,
  }
}

/** Count the documents matching the index's feature type and the given active `filters`. */
export async function fetchCount(
  index: GeoNetworkIndexConnection,
  filters: WmsFilterState = [],
  signal?: AbortSignal,
): Promise<number> {
  const query = filteredQuery(index, filters)
  const json = await esSearch<EsSearchResponse>(
    index,
    { size: 0, track_total_hits: true, query },
    signal,
  )

  return readTotal(json)
}

// A lone point has an empty extent, which OpenLayers would fit at maximum zoom.
const POINT_EXTENT_BUFFER_DEGREES = 0.05

/**
 * EPSG:4326 extent of the documents matching the given active `filters`, from the per-feature
 * `bbox_*` fields the GeoNetwork WFS harvester indexes; null when nothing matched.
 */
export async function fetchExtent(
  index: GeoNetworkIndexConnection,
  filters: WmsFilterState = [],
  signal?: AbortSignal,
): Promise<Extent | null> {
  const json = await esSearch<EsSearchResponse>(
    index,
    {
      size: 0,
      query: filteredQuery(index, filters),
      aggs: {
        xmin: { min: { field: 'bbox_xmin' } },
        ymin: { min: { field: 'bbox_ymin' } },
        xmax: { max: { field: 'bbox_xmax' } },
        ymax: { max: { field: 'bbox_ymax' } },
      },
    },
    signal,
  )

  const aggs = json.aggregations
  const [xmin, ymin, xmax, ymax] = [aggs?.xmin, aggs?.ymin, aggs?.xmax, aggs?.ymax].map(
    (agg) => agg?.value,
  )
  if (xmin == null || ymin == null || xmax == null || ymax == null) return null
  if (xmin !== xmax || ymin !== ymax) return [xmin, ymin, xmax, ymax]
  const b = POINT_EXTENT_BUFFER_DEGREES
  return [xmin - b, ymin - b, xmax + b, ymax + b]
}
