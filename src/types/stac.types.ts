/**
 * STAC Layer Type Definitions
 *
 * This file defines the MapLayerStac type and related structures for
 * representing STAC (SpatioTemporal Asset Catalog) layers in the map viewer.
 *
 * MapLayerStac extends the concept of MapContextLayer with STAC-specific
 * properties including filters, pagination, and cached items.
 */

import type { MapContextBaseLayer } from '@geospatial-sdk/core'
import type { StacCollection } from '@camptocamp/ogc-client'
import type { FeatureCollection } from 'geojson'

/**
 * STAC collection metadata (using ogc-client types).
 * This is a subset of StacCollection with display-relevant properties.
 */
export type StacCollectionMetadata = Pick<
  StacCollection,
  'title' | 'description' | 'license' | 'extent' | 'keywords'
>

/**
 * STAC Layer representation with filter and pagination configuration.
 *
 * This type is used internally by the map store and gets mapped to
 * MapContextLayerGeojson for rendering via the computed context property.
 * Runtime state (metadata, cached data, loading flags) is managed separately
 * in the store to keep this interface clean and configuration-focused.
 */
export interface MapLayerStac extends MapContextBaseLayer {
  type: 'stac'
  url: string
  collectionId?: string
  filters?: StacFilters
  initialFilters?: StacFilters
  pagination?: StacPagination
  data?: FeatureCollection
  error?: boolean
}

/**
 * StacLayerInfo data returned by STAC composable functions.
 * Contains metadata and updates to be applied to layer properties.
 */
export interface StacLayerInfo {
  label?: string
  filters?: StacFilters
  initialFilters?: StacFilters
  pagination?: StacPagination
  data?: FeatureCollection
  error?: boolean
}

/**
 * Filter configuration for STAC items.
 */
export interface StacFilters {
  /** Temporal filter based on datetime property */
  dateRange: DateRangeFilter

  /** Spatial filter based on bounding box intersection */
  spatialExtent: SpatialExtentFilter
}

/**
 * Temporal filter for STAC items.
 *
 * Both start and end are nullable:
 * - Both null: No temporal filter applied
 * - Only start: Filter items >= start
 * - Only end: Filter items <= end
 * - Both set: Filter items within range [start, end]
 */
export interface DateRangeFilter {
  /** Start date (inclusive), null means no start constraint */
  start: Date | null

  /** End date (inclusive), null means no end constraint */
  end: Date | null
}

/**
 * Spatial filter for STAC items based on map extent.
 *
 * When enabled, only items intersecting the specified bounding box
 * are fetched from the STAC API.
 */
export interface SpatialExtentFilter {
  /** Whether spatial filtering is active */
  enabled: boolean

  /** Bounding box [west, south, east, north] in WGS84 (EPSG:4326) */
  bbox: number[] | null
}

/**
 * Pagination state for STAC item results.
 *
 * Tracks current page, total count, and STAC API navigation links
 * for next/previous pages.
 */
export interface StacPagination {
  /** Current page number (1-indexed) */
  currentPage: number

  /** Total number of items matching filters (null if unknown) */
  returnedItems: number | null

  /** Number of items per page */
  itemsPerPage: number

  /** STAC API link to next page (null if on last page) */
  nextLink: string | null

  /** STAC API link to previous page (null if on first page) */
  previousLink: string | null
}

/**
 * Type guard to check if a layer is a STAC layer.
 *
 * @param layer - Layer to check
 * @returns True if layer is MapLayerStac
 */
export function isStacLayer(layer: unknown): layer is MapLayerStac {
  return typeof layer === 'object' && layer !== null && (layer as { type?: string }).type === 'stac'
}
