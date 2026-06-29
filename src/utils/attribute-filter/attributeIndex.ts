import type {
  AttributeFieldConfig,
  EsSearchResponse,
  FieldValue,
  FieldValues,
  GeonetworkSource,
} from './attributeIndex.types'

const DEFAULT_VALUES_SIZE = 50

// Each WFS attribute column is indexed as `ft_<COLUMN>_s` (keyword); other variants
// (`_s_tree`, `_dt`, …) are not value-list filterable.
const COLUMN_FIELD = /^ft_(.+)_s$/

/** POST an ES query to the source URL (itself the search action; no `/_search` is appended). */
async function esSearch<T>(
  source: GeonetworkSource,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(source.url, {
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

/** Term filter scoping queries to a single feature type, when the index is shared. */
function featureTypeQuery(source: GeonetworkSource): Record<string, unknown> | undefined {
  return source.featureType ? { term: { featureTypeId: source.featureType } } : undefined
}

// Scope a search to the source's feature type and `filters`; a lone feature-type term stays bare.
function filteredQuery(
  source: GeonetworkSource,
  filters: Array<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const featureType = featureTypeQuery(source)

  return filters.length === 0
    ? featureType
    : {
        bool: { filter: [...(featureType ? [featureType] : []), ...filters] },
      }
}

/**
 * Whether `docId` (raw `${wfsUrl}#${layers}`, URL-encoded internally) has a `harvesterReport`
 * document in the index — i.e. the layer is indexed. Exact `term` filters on the keyword `id`
 * and `docType`: a `query_string` would tokenize the encoded URL and match every report.
 */
export async function isLayerIndexed(
  source: GeonetworkSource,
  docId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const json = await esSearch<EsSearchResponse>(
    source,
    {
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
    },
    signal,
  )

  return readTotal(json) > 0
}

/**
 * Discover filterable columns from one sample document's `_source` (the index may expose no
 * public `_mapping`): every `ft_<COLUMN>_s` keyword field becomes an `equals` column on `<COLUMN>`.
 */
export async function discoverFields(
  source: GeonetworkSource,
  signal?: AbortSignal,
): Promise<AttributeFieldConfig[]> {
  const query = featureTypeQuery(source)
  const json = await esSearch<EsSearchResponse>(
    source,
    { size: 1, ...(query ? { query } : {}) },
    signal,
  )
  const properties = json.hits?.hits?.[0]?._source ?? {}

  const fields: AttributeFieldConfig[] = []
  for (const key of Object.keys(properties)) {
    const name = COLUMN_FIELD.exec(key)?.[1]
    if (!name) continue
    fields.push({ esField: name, label: name, aggField: key, match: 'equals' })
  }

  return fields
}

// Escape ES wildcard metacharacters so a value matches literally inside the surrounding `*…*`.
function escapeEsWildcard(value: string): string {
  return value.replace(/[\\*?]/g, (char) => `\\${char}`)
}

/** ES filter clause selecting the documents whose `field` matches any of `values`. */
export function buildFieldFilter(
  field: AttributeFieldConfig,
  values: string[],
): Record<string, unknown> {
  if (field.match === 'contains') {
    return {
      bool: {
        should: values.map((value) => ({
          wildcard: { [field.aggField]: `*${escapeEsWildcard(value)}*` },
        })),
        minimum_should_match: 1,
      },
    }
  }

  return { terms: { [field.aggField]: values } }
}

/**
 * Distinct values and counts of a column via a terms aggregation. `filters` (active selections)
 * narrow the counts to give faceted counts. Buckets come back ordered by descending count.
 */
export async function fetchFieldValues(
  source: GeonetworkSource,
  field: AttributeFieldConfig,
  filters: Array<Record<string, unknown>> = [],
  signal?: AbortSignal,
): Promise<FieldValues> {
  const size = DEFAULT_VALUES_SIZE
  const query = filteredQuery(source, filters)
  // Request one extra bucket so truncation is "more distinct values than the cap exist",
  // not ES's `sum_other_doc_count` which over-reports on multi-shard indices.
  const json = await esSearch<EsSearchResponse>(
    source,
    {
      size: 0,
      ...(query ? { query } : {}),
      aggs: {
        values: {
          terms: {
            field: field.aggField,
            size: size + 1,
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

/** Count the documents matching the source's feature type and the given active `filters`. */
export async function fetchCount(
  source: GeonetworkSource,
  filters: Array<Record<string, unknown>> = [],
  signal?: AbortSignal,
): Promise<number> {
  const query = filteredQuery(source, filters)
  const json = await esSearch<EsSearchResponse>(
    source,
    { size: 0, track_total_hits: true, ...(query ? { query } : {}) },
    signal,
  )

  return readTotal(json)
}
