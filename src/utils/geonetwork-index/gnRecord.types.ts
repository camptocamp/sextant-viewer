// Types for the Geonetwork record (see `gnRecord.ts`).

/** Parsed `applicationProfile` JSON from the WFS online resource. */
export interface GnWfsApplicationProfile {
  /**
   * If false (default), fields present in the index but absent from `fields`
   * are removed from the panel. If true, `fields` only extends/overrides.
   */
  extendOnly?: boolean

  /** Per-field configuration. `name` must match the indexed attribute name. */
  fields?: GnApplicationProfileField[]

  /**
   * Map of fieldName -> token separator. A field listed here is treated as
   * tokenized: filters become `like '*value*'` instead of `= 'value'`.
   * (This is the current replacement for the old Solr-era `tokenize`.)
   */
  tokenizedFields?: Record<string, string>

  /**
   * Fields treated as hierarchical trees in the facet UI (array of field names).
   * Passed to the indexer as `treeFields`.
   */
  treeFields?: string[]
}

export interface GnApplicationProfileField {
  /** Indexed attribute name — the join key. Required in practice. */
  name: string

  /**
   * Localized label, keyed by 2-letter language code (e.g. "fr", "en") as seen
   * in Sextant records. `profileToFields` reads `fr` then falls back to `en`.
   */
  label?: Record<string, string>

  /** Hide this field from the filter panel. */
  hidden?: boolean

  /**
   * Facet type hint. Observed values include "terms", "date", "rangeDate".
   * Defaults vary by context ("terms" for SLD, "date" for date facets).
   */
  type?: string

  /** For type: "rangeDate" — the min/max index field names backing the range. */
  minField?: string
  maxField?: string

  /** How the facet is rendered, e.g. "graph" | "form". */
  display?: string

  /** Free-text field definition/description shown in the UI. */
  definition?: string

  /** Suffix appended to displayed values (e.g. a unit). */
  suffix?: string

  /**
   * Elasticsearch aggregation spec for this field (histogram, range, filters, …).
   * Passed through mostly untouched, so typed loosely.
   * Example: { histogram: { interval: 5000, extended_bounds: { min, max } } }
   */
  aggs?: Record<string, unknown>
}

/** A single `OGC:WFS` online resource of a record, with its feature types and (optional) profile. */
export interface GnWfsResource {
  /** WFS service URL from the resource's `linkage`. */
  wfsUrl: string
  /**
   * Feature types the resource exposes, from its `<cit:name>` (comma-joined in the record).
   * Empty when the resource lists no name — then it is treated as backing every sublayer.
   */
  featureTypes: string[]
  /**
   * Parsed `applicationProfile` JSON, when present and valid. Absent when the resource carries no
   * profile (or it failed to parse) — the filter columns are then discovered from the index.
   */
  profile?: GnWfsApplicationProfile
}
