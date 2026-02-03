/**
 * Map Store Extension Contracts
 * 
 * This file defines the interface extensions needed for the map store
 * to support STAC layers alongside standard MapContextLayer types.
 */

import type { MapContextLayer, MapContext } from '@geospatial-sdk/core'
import type { MapLayerStac } from './stac-layer'

/**
 * Union type for all supported layer types.
 * 
 * This is used internally by the map store to handle both standard
 * MapContext layers and STAC layers.
 */
export type MapLayer = MapContextLayer | MapLayerStac

/**
 * Extended map store interface with STAC layer support.
 * 
 * The store maintains an internal array of MapLayer (union type) but
 * exposes a computed MapContext property that maps STAC layers to
 * standard GeoJSON layers for compatibility with geospatial-sdk.
 */
export interface MapStoreWithStac {
  /**
   * Internal layers array (includes STAC layers).
   * Not directly exposed to geospatial-sdk.
   */
  internalLayers: MapLayer[]
  
  /**
   * Computed MapContext property that maps STAC layers to GeoJSON.
   * This is what geospatial-sdk sees and renders.
   */
  context: MapContext
  
  /**
   * Add a layer (standard or STAC) to the map.
   * 
   * @param layer - Layer to add (MapContextLayer or MapLayerStac)
   */
  addLayer(layer: MapLayer): void
  
  /**
   * Remove a layer from the map.
   * 
   * @param layer - Layer to remove
   */
  deleteLayer(layer: MapLayer): void
  
  /**
   * Update a layer's properties.
   * 
   * @param layer - Layer to update
   * @param updates - Partial updates to apply
   */
  updateLayer(layer: MapLayer, updates: Partial<MapLayer>): void
  
  /**
   * Refetch items for a STAC layer.
   * 
   * This is called when filters change or pagination is triggered.
   * Sets loading state, fetches items from STAC API, updates layer.
   * 
   * @param layerId - ID of the STAC layer to refetch
   * @returns Promise that resolves when fetch completes
   */
  refetchStacLayerItems(layerId: string): Promise<void>
  
  /**
   * Navigate to next page of STAC items.
   * 
   * @param layerId - ID of the STAC layer
   * @returns Promise that resolves when fetch completes
   */
  goToNextStacPage(layerId: string): Promise<void>
  
  /**
   * Navigate to previous page of STAC items.
   * 
   * @param layerId - ID of the STAC layer
   * @returns Promise that resolves when fetch completes
   */
  goToPrevStacPage(layerId: string): Promise<void>
}

/**
 * Type guard to check if a layer is a MapContextLayer.
 * 
 * @param layer - Layer to check
 * @returns True if layer is a standard MapContextLayer
 */
export function isMapContextLayer(layer: MapLayer): layer is MapContextLayer {
  return layer.type !== 'stac'
}

/**
 * Get current map bounds in [west, south, east, north] format.
 * 
 * This is used for spatial extent filtering when the user enables
 * the "use current map extent" checkbox.
 * 
 * @param view - Current MapContext view
 * @returns Bounding box [west, south, east, north] or null if unavailable
 */
export function getMapBounds(view: MapContext['view']): number[] | null {
  if (!view?.extent) {
    return null
  }
  
  const [minX, minY, maxX, maxY] = view.extent
  return [minX, minY, maxX, maxY]
}
