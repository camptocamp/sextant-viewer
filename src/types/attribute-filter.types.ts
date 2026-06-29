/**
 * Attribute filter type definitions.
 *
 * An "attribute filter" lets the user restrict a WMS layer by the values of its columns. The
 * columns, their distinct values and counts are read from an ElasticSearch index. The index
 * backing a layer is detected internally (see `attributeFilterDetection.ts`): the layer's WFS
 * feature type is matched against the `dataSources` declared on the map context. The selected
 * values are translated into an OGC Filter applied to the WMS layer through its GetMap `FILTER`
 * parameter (the SDK `filter` field).
 *
 * The Geonetwork ElasticSearch primitives and their types live in `@/utils/attributeIndex`;
 * this module only adds the viewer-specific `DataSource`, `ActiveFilters` and per-layer
 * `AttributeFilterState`.
 */

import type { AttributeFieldConfig, GeonetworkSource } from '@/utils/attributeIndex.types'

/**
 * A data source declared on the map context. Only ElasticSearch is supported for now; the
 * `url` is the search endpoint (or same-origin proxy) probed to detect whether a layer is indexed.
 */
export interface DataSource {
  url: string
  type: 'elasticsearch'
}

/** Active selections keyed by `esField`. */
export type ActiveFilters = Record<string, string[]>

/**
 * Per-layer attribute-filter state stored under `extras.attributeFilter`. Detection sets
 * `source` (and `fields` when curated labels are available); the component caches the discovered
 * `fields` and the user's `active` selections (both persisted with the map context across reloads).
 */
export interface AttributeFilterState {
  source: GeonetworkSource
  /** Columns discovered from the index (or curated from a profile), cached so the FILTER can be rebuilt. */
  fields?: AttributeFieldConfig[]
  /** Active selections; persisted with the map context across reloads. */
  active?: ActiveFilters
}
