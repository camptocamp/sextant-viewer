// Types for the Geonetwork ElasticSearch index backing a WFS layer (see `attributeIndex.ts`).

/**
 * How selected values compare against the WFS column at GetMap time. `equals` matches the raw
 * column value; `contains` is for tokenized columns (the raw value is a separator-joined string,
 * e.g. `"Benthos;Microbiologie"`, while the index holds individual tokens) and matches by
 * substring (`PropertyIsLike *value*`). Both filter the index by exact token.
 */
export type MatchType = 'equals' | 'contains'

/** A single filterable column discovered from the index. */
export interface IndexField {
  /** Logical field name; also the key under which selections are stored. */
  esField: string
  /** Human-readable label shown in the UI. */
  label: string
  /** Aggregatable field used for the terms aggregation, e.g. `ft_<COLUMN>_s`. */
  aggField: string
  /** Index field kind; only `terms` (keyword) columns are filterable for now. */
  type: 'terms'
  /** WFS-side comparison for this column's values; `contains` for tokenized columns. */
  matchType: MatchType
}

export interface FieldValue {
  value: string
  count: number
}

/** Loaded values for a column. */
export interface DistinctFieldValues {
  esField: string
  values: FieldValue[]
  /** True when more distinct values exist than the cap. */
  truncated: boolean
}

/** @internal Shape of the relevant parts of an ElasticSearch `_search` response. */
export interface EsSearchResponse {
  hits?: {
    hits?: Array<{ _source?: Record<string, unknown> }>
    total?: number | { value: number }
  }
  aggregations?: {
    values?: {
      buckets?: Array<{ key: string | number; doc_count: number }>
    }
  }
}
