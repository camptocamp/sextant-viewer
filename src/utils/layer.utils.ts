import type { MapLayerStac } from '@/types/stac.types'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Union type combining standard MapContext layers with STAC layers.
 */
export type MapLayer = MapContextLayer | MapLayerStac

/**
 * Type guard to check if a layer is a STAC layer.
 * @param layer - Layer to check
 * @returns True if layer is MapLayerStac
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStacLayer(layer: any): layer is MapLayerStac {
  return typeof layer === 'object' && layer !== null && (layer as { type?: string }).type === 'stac'
}

/**
 * Type guard to identify basemap layers
 * @param layer - The layer to check
 * @returns true if layer is a basemap, false otherwise
 */
export function isBasemapLayer(layer: MapLayer): boolean {
  return layer.extras?.basemap === true
}

/**
 * Get display label for a layer with fallback
 * @param layer - The layer to get label from
 * @returns Layer label or 'Untitled Layer' if no label exists
 */
export function getLayerLabel(layer: MapLayer): string {
  return layer.label || 'Couche sans titre'
}
