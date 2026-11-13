// Types for the Geonetwork ElasticSearch index backing a WFS layer (see `attributeIndex.ts`).

/**
 * How selected values compare against the WFS column at GetMap time. `equals` matches the raw
 * column value; `contains` is for tokenized columns (the raw value is a separator-joined string,
 * e.g. `"Benthos;Microbiologie"`, while the index holds individual tokens) and matches by
 * substring (`PropertyIsLike *value*`). `tree` is for hierarchical columns: values are `/`-joined
 * paths, and a selected path matches itself and its descendants. All filter the index by exact
 * token.
 */
export type MatchType = 'equals' | 'contains' | 'tree'

interface BaseIndexField {
  /** Logical field name; also the key under which selections are stored. */
  esField: string
  /** Human-readable label shown in the UI. */
  label: string
}

/** A value-list column, filtered by checking values. */
export interface TermsIndexField extends BaseIndexField {
  type: 'terms'
  /** Aggregatable field used for the terms aggregation, e.g. `ft_<COLUMN>_s`. */
  aggField: string
  /** WFS-side comparison for this column's values; `contains` for tokenized columns. */
  matchType: 'equals' | 'contains'
}

/**
 * A hierarchical column (profile `treeFields`): values are `/`-joined paths, indexed with a
 * path-hierarchy analyzer so every ancestor path is a token of its own.
 */
export interface TreeIndexField extends BaseIndexField {
  type: 'tree'
  /** Path-tokenized field, e.g. `ft_<COLUMN>_s_tree`. */
  aggField: string
  /** Separator between paths in the raw WFS value, when the column also is tokenized. */
  tokenSeparator?: string
}

/**
 * A period facet (profile `rangeDate`): each feature spans `minField`..`maxField`, and a feature
 * matches when its period overlaps the selected one.
 */
export interface DateRangeIndexField extends BaseIndexField {
  type: 'dateRange'
  /** WFS columns holding the start and end of each feature's period (`ft_<COLUMN>_dt` in the index). */
  minField: string
  maxField: string
}

/** A single filterable column discovered from the index. */
export type IndexField = TermsIndexField | TreeIndexField | DateRangeIndexField

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

/** Earliest start and latest end of the features' periods, as `YYYY-MM-DD`. */
export interface DateBounds {
  min: string
  max: string
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
    xmin?: EsMetricAggregation
    ymin?: EsMetricAggregation
    xmax?: EsMetricAggregation
    ymax?: EsMetricAggregation
    dateMin?: EsMetricAggregation
    dateMax?: EsMetricAggregation
  }
}

/**
 * @internal A `min`/`max` aggregation result; `value` is null when no document matched. Date
 * fields also carry `value_as_string`, formatted with the field's first mapping format.
 */
interface EsMetricAggregation {
  value: number | null
  value_as_string?: string
}
