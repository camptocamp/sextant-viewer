/**
 * STAC Layer Type Definitions
 * 
 * This file defines the MapLayerStac type and related structures for
 * representing STAC (SpatioTemporal Asset Catalog) layers in the map viewer.
 * 
 * MapLayerStac extends the concept of MapContextLayer with STAC-specific
 * properties including filters, pagination, and cached items.
 */

import type { GeoJSON } from 'geojson'

/**
 * STAC Layer representation with embedded filter and pagination state.
 * 
 * This type is used internally by the map store and gets mapped to
 * MapContextLayerGeojson for rendering via the computed context property.
 */
export interface MapLayerStac {
  /** Layer type discriminator (always 'stac') */
  type: 'stac'
  
  /** Unique layer identifier */
  id: string
  
  /** STAC API base URL (e.g., 'https://stacapi.example.com') */
  url: string
  
  /** STAC collection identifier */
  collectionId: string
  
  /** Human-readable layer name */
  label: string
  
  /** Whether the layer is visible on the map */
  visibility: boolean
  
  /** Layer version for change tracking (incremented on updates) */
  version: number
  
  /** Current filter configuration */
  filters: StacFilters
  
  /** Pagination state and navigation links */
  pagination: StacPagination
  
  /** Cached STAC items (GeoJSON Features) for current page */
  items: GeoJSON.Feature[]
  
  /** Whether items are currently being fetched */
  loading: boolean
  
  /** Error message if last fetch failed, null otherwise */
  error: string | null
  
  /** Optional collection metadata from STAC API */
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
export function isStacLayer(layer: any): layer is MapLayerStac {
  return layer && typeof layer === 'object' && layer.type === 'stac'
}

/**
 * Create a new STAC layer with default values.
 * 
 * @param params - Partial STAC layer parameters
 * @returns Complete MapLayerStac with defaults
 */
export function createStacLayer(params: {
  id: string
  url: string
  collectionId: string
  label: string
}): MapLayerStac {
  return {
    type: 'stac',
    id: params.id,
    url: params.url,
    collectionId: params.collectionId,
    label: params.label,
    visibility: true,
    version: 0,
    filters: {
      dateRange: {
        start: null,
        end: null,
      },
      spatialExtent: {
        enabled: false,
        bbox: null,
      },
    },
    pagination: {
      currentPage: 1,
      totalItems: null,
      itemsPerPage: 50,
      nextLink: null,
      prevLink: null,
    },
    items: [],
    loading: false,
    error: null,
  }
}
