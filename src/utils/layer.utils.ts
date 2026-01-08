import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Type guard to identify basemap layers
 * @param layer - The layer to check
 * @returns true if layer is a basemap, false otherwise
 */
export function isBasemapLayer(layer: MapContextLayer): boolean {
  return layer.extras?.basemap === true
}

/**
 * Get display label for a layer with fallback
 * @param layer - The layer to get label from
 * @returns Layer label or 'Untitled Layer' if no label exists
 */
export function getLayerLabel(layer: MapContextLayer): string {
  return layer.label || 'Untitled Layer'
}
