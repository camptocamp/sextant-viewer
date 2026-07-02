import type { MapContextLayerWms, LayerExtras } from '@geospatial-sdk/core'
import type { IndexField } from '@/utils/geonetwork-index/attributeIndex.types'

/**
 * Connection to a GeoNetwork data index backed by ElasticSearch
 */
export interface GeoNetworkIndexConnection {
  /** Search endpoint URL (the request is POSTed here as-is), e.g. `/geonetwork/index/features`. */
  url: string
  /**
   * Feature-type values scoping queries to this layer in the shared index, via a `terms` filter on
   * the `featureTypeId` field. One per WMS sublayer, each the URL-encoded `${wfsUrl}#${sublayer}`.
   */
  featureTypeIds: string[]
  /** Filterable columns discovered at detection time (from the GN record's applicationProfile). */
  fields?: IndexField[]
}

export interface FilterByAttribute {
  attributeName: string
  matchType: 'contains' | 'equals'
  values: string[]
}

export type WmsFilterState = FilterByAttribute[]

export interface ExtendedMapLayerWms extends MapContextLayerWms {
  extras?: LayerExtras & {
    filter?: WmsFilterState
    dataIndex?: GeoNetworkIndexConnection
  }
}
