import type { Extent, MapContextLayerWms, LayerExtras } from '@geospatial-sdk/core'
import type { AnyWmsDimension } from '@/utils/wms.utils'
import type { IndexField, MatchType } from '@/utils/geonetwork-index/attributeIndex.types'
import type { LayerWpsProcess } from '@/types/wps.types'

/**
 * Connection to a GeoNetwork data index backed by ElasticSearch
 */
export interface GeoNetworkIndexConnection {
  /** Search endpoint URL (the request is POSTed here as-is), e.g. `/geonetwork/index/features`. */
  url: string
  /**
   * Feature-type values scoping queries to this layer in the shared index, via a `terms` filter on
   * the `featureTypeId` field. One per backing WFS resource, each the URL-encoded
   * `${wfsUrl}#${featureTypes}` where `featureTypes` is the resource's comma-joined feature-type
   * name as the indexer stored it.
   */
  featureTypeIds: string[]
  /**
   * Filterable columns resolved at detection time: from the GN record's `applicationProfile` when
   * it has one, otherwise discovered from a sample index document.
   */
  fields?: IndexField[]
  /**
   * WFS geometry property, resolved at detection time when the index holds feature geometries;
   * its presence enables the geographic-area filter (the OGC `BBOX` names it).
   */
  geometryName?: string
}

/** Selected values of a column. Has no `kind`, so filters persisted before the others read on. */
export interface FilterByAttribute {
  kind?: never
  attributeName: string
  matchType: MatchType
  values: string[]
  /** For a tokenized `tree` column: the separator between paths in the raw WFS value. */
  tokenSeparator?: string
}

/** Features whose `minField`..`maxField` period overlaps `from`..`to` (`YYYY-MM-DD`, inclusive). */
export interface FilterByDateRange {
  kind: 'dateRange'
  /** The profile field's name, under which the selection is stored. */
  attributeName: string
  minField: string
  maxField: string
  from: string
  to: string
}

/** Features whose geometry intersects `extent` (EPSG:4326). */
export interface FilterByBbox {
  kind: 'bbox'
  geometryName: string
  extent: Extent
}

export type WmsFilter = FilterByAttribute | FilterByDateRange | FilterByBbox

export type WmsFilterState = WmsFilter[]

export interface ExtendedMapLayerWms extends MapContextLayerWms {
  extras?: LayerExtras & {
    filter?: WmsFilterState
    dataIndex?: GeoNetworkIndexConnection
    /** WPS processes the layer's metadata record declares (derived — never persisted). */
    wpsProcesses?: LayerWpsProcess[]
    /** Dimensions the server declares, flattened (derived — never persisted). */
    wmsDimensions?: AnyWmsDimension[]
  }
}
