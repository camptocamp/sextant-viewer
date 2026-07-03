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

/** POST an ES query to the index URL (itself the search action; no `/_search` is appended). */
async function esSearch<T>(index: GeoNetworkIndexConnection, body: unknown): Promise<T> {
  const response = await fetch(index.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
export async function discoverFields(index: GeoNetworkIndexConnection): Promise<IndexField[]> {
  const json = await esSearch<EsSearchResponse>(index, { size: 1, query: filteredQuery(index) })
  const properties = json.hits?.hits?.[0]?._source ?? {}

  const fields: IndexField[] = []
  for (const key of Object.keys(properties)) {
    // TODO: support other types of fields (value trees, date time...)

    const name = TERMS_FIELD_MATCH.exec(key)?.[1]
    if (!name) continue

    fields.push({ esField: name, label: name, aggField: key, type: 'terms', matchType: 'equals' })
  }

  return fields
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
 */
export async function fetchFieldValues(
  index: GeoNetworkIndexConnection,
  field: IndexField,
  filters: WmsFilterState = [],
): Promise<DistinctFieldValues> {
  // This has to be a 'terms' field; if not, no way to obtain distinct values
  if (field.type !== 'terms') {
    throw new Error(`Unsupported field type: ${field.type}`)
  }

  const size = DEFAULT_FIELD_VALUES_LIMIT
  const query = filteredQuery(index, filters)

  // Request one extra bucket so truncation is "more distinct values than the cap exist",
  // not ES's `sum_other_doc_count` which over-reports on multi-shard indices.
  const json = await esSearch<EsSearchResponse>(index, {
    size: 0,
    query,
    aggs: {
      values: {
        terms: {
          field: field.aggField,
          size: size + 1,
        },
      },
    },
  })

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
): Promise<number> {
  const query = filteredQuery(index, filters)
  const json = await esSearch<EsSearchResponse>(index, { size: 0, track_total_hits: true, query })

  return readTotal(json)
}
