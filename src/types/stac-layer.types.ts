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

/**
 * STAC Layer representation with embedded filter and pagination state.
 *
 * This type is used internally by the map store and gets mapped to
 * MapContextLayerGeojson for rendering via the computed context property.
 */
export interface MapLayerStac extends MapContextBaseLayer {
  type: 'stac'
  url: string
  collectionId?: string
  filters?: StacFilters
  pagination?: StacPagination
  error?: string | null
  collectionMetadata?: StacCollectionMetadata
}

/**
 * STAC collection metadata (for display purposes).
 */
export interface StacCollectionMetadata {
  /** Collection title */
  title?: string

  /** Collection description */
  description?: string

  /** Data license */
  license?: string

  /** Collection spatial and temporal extent */
  extent?: {
    spatial?: {
      bbox: number[][]
    }
    temporal?: {
      interval: (string | null)[][]
    }
  }

  /** Collection keywords */
  keywords?: string[]
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
  totalItems: number | null

  /** Number of items per page */
  itemsPerPage: number

  /** STAC API link to next page (null if on last page) */
  nextLink: string | null

  /** STAC API link to previous page (null if on first page) */
  prevLink: string | null
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
