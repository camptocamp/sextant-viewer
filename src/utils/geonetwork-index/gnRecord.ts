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

/** First descendant text by local name (namespace-agnostic), trimmed. */
function localText(parent: Element, local: string): string | undefined {
  return parent.getElementsByTagNameNS('*', local)[0]?.textContent?.trim() || undefined
}

/**
 * Fetch the metadata record and return its `OGC:WFS` online resource's url + parsed
 * `applicationProfile`. Returns `null` when the record can't be read, has no WFS resource with a
 * profile, or the profile JSON is malformed — i.e. the layer is not filterable.
 */
export async function fetchWfsResource(
  gnBase: string,
  uuid: string,
): Promise<{ wfsUrl: string; profile: GnWfsApplicationProfile } | null> {
  const res = await fetch(`${gnBase}/srv/api/records/${uuid}/formatters/xml`)
  if (!res.ok) return null

  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')

  const resources = doc.getElementsByTagNameNS('*', 'CI_OnlineResource')
  for (const resource of Array.from(resources)) {
    if (!localText(resource, 'protocol')?.startsWith('OGC:WFS')) continue

    // ISO 19115-3: the linkage value is a `gco:CharacterString` (not a `<URL>` element).
    const wfsUrl = localText(resource, 'linkage')
    const raw = localText(resource, 'applicationProfile')
    if (!wfsUrl || !raw) continue

    try {
      return { wfsUrl, profile: JSON.parse(raw) as GnWfsApplicationProfile }
    } catch {
      return null
    }
  }

  return null
}
