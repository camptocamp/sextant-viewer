import type {
  IndexField,
  EsSearchResponse,
  FieldValue,
  DistinctFieldValues,
} from './attributeIndex.types'
import type { GeoNetworkIndexConnection, WmsFilterState } from '../../types/wms.types'

// Maximum number of distinct attribute values to fetch for a column.
const DEFAULT_FIELD_VALUES_LIMIT = 50

// Each WFS attribute column is indexed as `ft_<COLUMN>_s` (keyword); other variants
// (`_s_tree`, `_dt`, …) are not value-list filterable.
const TERMS_FIELD_MATCH = /^ft_(.+)_s$/

/** POST an ES query to the source URL (itself the search action; no `/_search` is appended). */
async function esSearch<T>(
  index: GeoNetworkIndexConnection,
  body: unknown,
): Promise<T> {
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

/** Term filter scoping queries to the source's feature type in the shared index. */
// function featureTypeQuery(index: GeoNetworkIndexConnection): Record<string, unknown> {
//   return { term: { featureTypeId: index.featureTypeId } }
// }

// Scope a search to the source's feature type and `filters`; a lone feature-type term stays bare.
function filteredQuery(
  index: GeoNetworkIndexConnection,
  filters?: WmsFilterState
): Record<string, unknown> {
  // FIXME: build a proper ElasticSearch filter clause from the WMS filter
  return { bool:
    { filter:
      [{ term: { featureTypeId: index.featureTypeId } }, ...(filters ?? [])]
    }
  }
}

// /**
//  * Whether `docId` (raw `${wfsUrl}#${layers}`, URL-encoded internally) has a `harvesterReport`
//  * document in the index — i.e. the layer is indexed. Exact `term` filters on the keyword `id`
//  * and `docType`: a `query_string` would tokenize the encoded URL and match every report.
//  */
// export async function isLayerIndexed(
//   source: GeonetworkSource,
//   docId: string,
// ): Promise<boolean> {
//   const json = await esSearch<EsSearchResponse>(
//     source,
//     {
//       size: 0,
//       track_total_hits: true,
//       query: {
//         bool: {
//           filter: [
//             { term: { id: encodeURIComponent(docId) } },
//             { term: { docType: 'harvesterReport' } },
//           ],
//         },
//       },
//     },
//   )

//   return readTotal(json) > 0
// }

/**
 * Discover filterable columns from one sample document's `_source` (the index may expose no
 * public `_mapping`): every `ft_<COLUMN>_s` keyword field becomes an `equals` column on `<COLUMN>`.
 */
export async function discoverFields(
  index: GeoNetworkIndexConnection,
): Promise<IndexField[]> {
  const json = await esSearch<EsSearchResponse>(
    index,
    { size: 1, query: filteredQuery(index) },
  )
  const properties = json.hits?.hits?.[0]?._source ?? {}

  const fields: IndexField[] = []
  for (const key of Object.keys(properties)) {
    // TODO: support other types of fields (value trees, date time...)
    const name = TERMS_FIELD_MATCH.exec(key)?.[1]
    if (!name) continue
    fields.push({ esField: name, label: name, aggField: key, type: 'terms' })
  }

  return fields
}

// Escape ES wildcard metacharacters so a value matches literally inside the surrounding `*…*`.
// function escapeEsWildcard(value: string): string {
//   return value.replace(/[\\*?]/g, (char) => `\\${char}`)
// }

/** ES filter clause selecting the documents whose `field` matches any of `values`. */
export function buildFieldFilter(
  field: IndexField,
  values: string[],
): Record<string, unknown> { // FIXME: type properly as a query clause
  switch (field.type) {
    // case 'text':
    //   return {
    //   bool: {
    //     should: values.map((value) => ({
    //       wildcard: { [field.aggField]: `*${escapeEsWildcard(value)}*` },
    //     })),
    //     minimum_should_match: 1,
    //   },
    // }
    case 'terms':
      return { terms: { [field.aggField]: values } }
  }

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
  // FIXME: this has to be a 'terms' field; if not, no way to obtain distinct values

  const size = DEFAULT_FIELD_VALUES_LIMIT
  const query = filteredQuery(index, filters)
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
          },
        },
      },
    },
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
  index: GeoNetworkIndexConnection,
  filters: WmsFilterState = [],
): Promise<number> {
  const query = filteredQuery(index, filters)
  const json = await esSearch<EsSearchResponse>(
    index,
    { size: 0, track_total_hits: true, query },
  )

  return readTotal(json)
}
