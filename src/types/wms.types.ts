import type { MapContextLayerWms, LayerExtras } from '@geospatial-sdk/core'
import type { IndexField } from '@/utils/geonetwork-index/attributeIndex.types'

/**
 * Connection to a GeoNetwork data index backed by ElasticSearch
 */
export interface GeoNetworkIndexConnection {
  /** Search endpoint URL (the request is POSTed here as-is), e.g. `/geonetwork/srv/index/_search`. */
  url: string
  /**
   * Feature-type value scoping queries to one layer in the shared index, via a term filter on the
   * `featureTypeId` field. Derived at detection time as the URL-encoded `${wfsUrl}#${layerName}`.
   */
  featureTypeId: string
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
