import type { Extent } from '@geospatial-sdk/core'
import type {
  DateBounds,
  DateRangeIndexField,
  DistinctFieldValues,
  EsDateBoundsResponse,
  EsSearchResponse,
  EsExtentResponse,
  FieldValue,
  IndexField,
  TermsIndexField,
  TreeIndexField,
} from './attributeIndex.types'
import type { GeoNetworkIndexConnection, WmsFilter, WmsFilterState } from '@/types/wms.types'
import { dayAfter } from '../date.utils'
import { clampToGlobe, MAX_LATITUDE } from '../geo.utils'
import { PATH_SEPARATOR } from './pathTree'

// Maximum number of distinct attribute values to fetch for a column.
const DEFAULT_FIELD_VALUES_LIMIT = 50
// Maximum number of nodes of the visible tree levels; levels load lazily, so this is a safety cap.
const TREE_VALUES_LIMIT = 1000

// Each WFS attribute column is indexed as `ft_<COLUMN>_s` (keyword), a tree column as
// `ft_<COLUMN>_s_tree` and a date column as `ft_<COLUMN>_dt`.
const TERMS_FIELD_MATCH = /^ft_(.+)_s$/
const TREE_FIELD_MATCH = /^ft_(.+)_s_tree$/
const termsFieldName = (column: string) => `ft_${column}_s`
const treeFieldName = (column: string) => `ft_${column}_s_tree`
const dateFieldName = (column: string) => `ft_${column}_dt`

// The harvester indexes each feature geometry, reprojected to CRS84, in this `geo_shape` field.
const GEOMETRY_FIELD = 'geom'
const DATE_FORMAT = 'yyyy-MM-dd'

const LUCENE_REGEX_RESERVED = /[.?+*|{}[\]()"\\#@&<>~]/

const escapeLuceneChar = (char: string) => (LUCENE_REGEX_RESERVED.test(char) ? `\\${char}` : char)
const escapeLucene = (text: string) => [...text].map(escapeLuceneChar).join('')

// Building blocks of the tree path patterns.
const SEPARATOR = escapeLucene(PATH_SEPARATOR)
const LEVEL_CHAR = `[^${SEPARATOR}]`
const LEVEL = `${LEVEL_CHAR}+`

const stripAccents = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '')

/**
 * Base letter → class content of its cases and accented forms (`e` → `eEèéêëÈÉÊË`). Latin-1
 * covers French; wider ranges would push a {@link SEARCH_MAX_LENGTH} term past ES's default
 * `index.max_regex_length` (1000). Letters without a decomposition (`æ`, `ø`, `ß`) are left out.
 */
const ACCENT_CLASSES = (() => {
  const classes = new Map<string, string>()
  for (let code = 0xc0; code <= 0xff; code++) {
    const char = String.fromCodePoint(code)
    const base = stripAccents(char).toLowerCase()
    if (base === char.toLowerCase()) continue
    classes.set(base, (classes.get(base) ?? base + base.toUpperCase()) + char)
  }
  return classes
})()

/** Longest search term, keeping the generated pattern under `index.max_regex_length`. */
export const SEARCH_MAX_LENGTH = 50

/**
 * Lucene regex body matching `term`, ignoring case and accents: `include` regexes have no flag
 * for either, so each letter becomes a class of all its forms (`e` → `[eEèéÈÉ…]`).
 */
function caseAndAccentInsensitive(term: string): string {
  return [...stripAccents(term)]
    .map((char) => {
      const accented = ACCENT_CLASSES.get(char.toLowerCase())
      if (accented) return `[${accented}]`
      const lower = char.toLowerCase()
      const upper = char.toUpperCase()
      // Skip classes for case mappings that change length (e.g. `ß` → `SS`).
      if (lower !== upper && lower.length === 1 && upper.length === 1) return `[${lower}${upper}]`
      return escapeLuceneChar(char)
    })
    .join('')
}

/** Lucene regex matching values that contain `term`, ignoring case and accents. */
function containsPattern(term: string): string {
  return `.*${caseAndAccentInsensitive(term)}.*`
}

/**
 * Lucene regex matching the paths whose last level contains `term`, ignoring case and accents, so
 * a match on an ancestor doesn't bring back its whole subtree. A `term` holding the separator
 * spans the last levels it crosses, like a path (`eau)/mé` matches `Chimie (eau)/Métaux`), as in
 * the previous Sextant viewer.
 */
function lastLevelContainsPattern(term: string): string {
  return `(.*${SEPARATOR})?${LEVEL_CHAR}*${caseAndAccentInsensitive(term)}${LEVEL_CHAR}*`
}

/**
 * Lucene regex matching the visible tree levels — the roots and the children of each `expanded`
 * path — plus one level ahead, so each visible node is known to have children or not.
 */
function visibleLevelsPattern(expanded: readonly string[]): string {
  const rootsAndChildren = `${LEVEL}(${SEPARATOR}${LEVEL})?`
  const grandchildren = expanded.map(
    (path) => `${escapeLucene(path)}${SEPARATOR}${LEVEL}${SEPARATOR}${LEVEL}`,
  )
  return [rootsAndChildren, ...grandchildren].join('|')
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
 * public `_mapping`): every `ft_<COLUMN>_s` keyword field becomes a `terms` column on `<COLUMN>`,
 * every `ft_<COLUMN>_s_tree` field a `tree` column — which wins when both exist, a column having a
 * single facet. Date ranges pair two columns, which only a profile declares.
 */
export function fieldsFromSource(source: Record<string, unknown>): IndexField[] {
  const fields: IndexField[] = []
  for (const key of Object.keys(source)) {
    const terms = TERMS_FIELD_MATCH.exec(key)?.[1]
    if (terms) {
      if (`${key}_tree` in source) continue
      fields.push({
        esField: terms,
        label: terms,
        aggField: key,
        type: 'terms',
        matchType: 'equals',
      })
      continue
    }
    const tree = TREE_FIELD_MATCH.exec(key)?.[1]
    if (tree) fields.push({ esField: tree, label: tree, aggField: key, type: 'tree' })
  }

  return fields
}

/** Whether a sample `_source` carries the feature geometry (the geographic-area filter needs it). */
export function hasGeometry(source: Record<string, unknown>): boolean {
  return source[GEOMETRY_FIELD] != null
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

/** `geo_shape` envelope (upper-left, lower-right) of an EPSG:4326 extent, clamped to the globe. */
function envelope(extent: Extent): number[][] {
  const [minx, miny, maxx, maxy] = clampToGlobe(extent)
  return [
    [minx, maxy],
    [maxx, miny],
  ]
}

/**
 * ES filter clause for an active filter, matching the WMS-side clause of `buildWmsFilterParam`:
 * - values: any of the selected values, by exact token (tokenized columns are indexed
 *   token-per-token, so `contains` only changes the WFS-side comparison). Tree paths match their
 *   descendants too, since every ancestor path is indexed as a token;
 * - date range: features whose period overlaps the selected days;
 * - bbox: features whose geometry intersects the extent.
 */
export function buildFieldFilter(filter: WmsFilter): Record<string, unknown> {
  switch (filter.kind) {
    case 'dateRange':
      return {
        bool: {
          filter: [
            {
              range: {
                [dateFieldName(filter.minField)]: { lt: dayAfter(filter.to), format: DATE_FORMAT },
              },
            },
            {
              range: {
                [dateFieldName(filter.maxField)]: { gte: filter.from, format: DATE_FORMAT },
              },
            },
          ],
        },
      }
    case 'bbox':
      return {
        geo_shape: {
          [GEOMETRY_FIELD]: {
            shape: { type: 'envelope', coordinates: envelope(filter.extent) },
            relation: 'intersects',
          },
        },
      }
    case 'values': {
      const field = filter.matchType === 'tree' ? treeFieldName : termsFieldName
      return { terms: { [field(filter.attributeName)]: filter.values } }
    }
  }
}

/**
 * Distinct values and counts of a column via a terms aggregation. `filters` (active selections)
 * narrow the counts to give faceted counts. Buckets come back ordered by descending count.
 * `search` keeps only the values containing it (ignoring case and accents); it filters buckets, not
 * documents, so a tokenized column doesn't bring back the other tokens of matching documents.
 */
export async function fetchFieldValues(
  index: GeoNetworkIndexConnection,
  field: IndexField,
  filters: WmsFilterState = [],
  { signal, search = '' }: { signal?: AbortSignal; search?: string } = {},
): Promise<DistinctFieldValues> {
  // Tree columns load level by level (`fetchTreeValues`); date ranges have no value list.
  if (field.type !== 'terms') {
    throw new Error(`Unsupported field type: ${field.type}`)
  }

  const term = search.trim()
  return fetchBuckets(index, field, filters, {
    size: DEFAULT_FIELD_VALUES_LIMIT,
    include: term ? containsPattern(term) : undefined,
    signal,
  })
}

/**
 * Nodes of a tree column, with faceted counts. Without `search`, the visible levels (roots and
 * children of each `expanded` path) plus one level ahead, so levels load as they are expanded;
 * with it, the paths whose last level contains it, capped like a values list. Ancestors of a match
 * are implied by its path.
 */
export async function fetchTreeValues(
  index: GeoNetworkIndexConnection,
  field: TreeIndexField,
  filters: WmsFilterState,
  {
    expanded = [],
    search = '',
    signal,
  }: { expanded?: readonly string[]; search?: string; signal?: AbortSignal } = {},
): Promise<DistinctFieldValues> {
  const term = search.trim()
  return fetchBuckets(
    index,
    field,
    filters,
    term
      ? { size: DEFAULT_FIELD_VALUES_LIMIT, include: lastLevelContainsPattern(term), signal }
      : { size: TREE_VALUES_LIMIT, include: visibleLevelsPattern(expanded), signal },
  )
}

/** Terms aggregation on `field.aggField`, narrowed to the buckets matching `include`. */
async function fetchBuckets(
  index: GeoNetworkIndexConnection,
  field: TermsIndexField | TreeIndexField,
  filters: WmsFilterState,
  { size, include, signal }: { size: number; include?: string; signal?: AbortSignal },
): Promise<DistinctFieldValues> {
  // Request one extra bucket so truncation is "more distinct values than the cap exist",
  // not ES's `sum_other_doc_count` which over-reports on multi-shard indices.
  const json = await esSearch<EsSearchResponse>(
    index,
    {
      size: 0,
      query: filteredQuery(index, filters),
      aggs: {
        values: {
          terms: { field: field.aggField, size: size + 1, ...(include && { include }) },
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

/**
 * Earliest start and latest end of the features' periods over the whole layer (not faceted, so
 * the date inputs keep stable bounds); null when no feature has a period.
 */
export async function fetchDateBounds(
  index: GeoNetworkIndexConnection,
  field: DateRangeIndexField,
  signal?: AbortSignal,
): Promise<DateBounds | null> {
  const json = await esSearch<EsDateBoundsResponse>(
    index,
    {
      size: 0,
      query: filteredQuery(index),
      aggs: {
        dateMin: { min: { field: dateFieldName(field.minField), format: DATE_FORMAT } },
        dateMax: { max: { field: dateFieldName(field.maxField), format: DATE_FORMAT } },
      },
    },
    signal,
  )

  const min = json.aggregations?.dateMin?.value_as_string
  const max = json.aggregations?.dateMax?.value_as_string
  return min && max ? { min, max } : null
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
  const json = await esSearch<EsExtentResponse>(
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
  const buffer = POINT_EXTENT_BUFFER_DEGREES
  // Past ±90°, the Web Mercator transform yields NaN; longitude overflow is harmless.
  return [
    xmin - buffer,
    Math.max(ymin - buffer, -MAX_LATITUDE),
    xmax + buffer,
    Math.min(ymax + buffer, MAX_LATITUDE),
  ]
}
