// Viewer-specific attribute-filter types. The ES primitives live in `attributeIndex.types`.

/** A data source declared on the map context, probed to detect whether a layer underlying data is indexed. */
export interface DataSource {
  url: string
  type: 'geonetwork-index'
}

/** Active selections keyed by `esField`. */
// export type ActiveFilters = Record<string, string[]>

// /**
//  * Per-layer attribute-filter state stored under `extras.attributeFilter`, persisted with the map
//  * context across reloads. Detection sets `source`; `fields` and `active` are cached by the UI.
//  */
// export interface DataFilterState {
//   source: GeonetworkSource
//   /** Columns discovered from the index or curated from a profile, cached to rebuild the FILTER. */
//   fields?: AttributeFieldConfig[]
//   active?: ActiveFilters
// }
