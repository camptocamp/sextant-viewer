/**
 * Helpers to discover and query the Geonetwork ElasticSearch index backing a WFS layer.
 *
 * Geonetwork harvests WFS feature types into an ElasticSearch index: one `harvesterReport`
 * document per indexed layer, and one document per feature with its columns exposed as
 * `ft_<COLUMN>_s` keyword fields. These helpers detect whether a layer is indexed and read
 * its filterable columns, their distinct values and occurrence counts.
 */

/** How a selected value is meant to be matched (kept for callers building OGC filters). */
export type AttributeMatch = 'equals' | 'contains'

/** Locates the Geonetwork ElasticSearch endpoint, optionally scoped to a single feature type. */
export interface GeonetworkSource {
  /** Search endpoint URL (the request is POSTed here as-is), e.g. `/geonetwork/srv/index/_search`. */
  url: string
  /**
   * Feature-type value when a single index holds several feature types. When set, queries are
   * scoped with a term filter on the `featureTypeId` field.
   */
  featureType?: string
}

/** A single filterable column discovered from the index. */
export interface AttributeFieldConfig {
  /** Logical field name; also the key under which selections are stored. */
  esField: string
  /** Human-readable label shown in the UI. */
  label: string
  /** Aggregatable field used for the terms aggregation (defaults to `${esField}.keyword`). */
  aggField?: string
  /** How a value is meant to be matched; `equals` for keyword columns, `contains` for text. */
  match?: AttributeMatch
}

/** A distinct value of a column together with its occurrence count. */
export interface FieldValue {
  value: string
  count: number
}

/** Loaded values for a column. */
export interface FieldValues {
  esField: string
  values: FieldValue[]
  /** True when the terms aggregation may have been truncated to `valuesSize`. */
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
