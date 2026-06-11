import type { MapLayerStac } from '@/types/stac.types'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Union type combining standard MapContext layers with STAC layers.
 */
export type MapLayer = (MapContextLayer | MapLayerStac) & { error?: boolean }

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
 * Type guard to check if a layer is a WMS layer.
 */
export function isWmsLayer(layer: MapLayer): boolean {
  return layer.type === 'wms'
}

/**
 * Type guard to check if a layer is a WMTS layer.
 */
export function isWmtsLayer(layer: MapLayer): boolean {
  return layer.type === 'wmts'
}

/**
 * Whether a layer can carry a legend.
 */
export function hasLegendSupport(layer: MapLayer): boolean {
  return isWmsLayer(layer) || isWmtsLayer(layer)
}

/**
 * Read the legend URL resolved at layer-load time, if any.
 */
export function getLegendUrl(layer: MapLayer): string | undefined {
  return layer.extras?.legendUrl as string | undefined
}

/**
 * Get display label for a layer with fallback
 * @param layer - The layer to get label from
 * @returns Layer label or 'Untitled Layer' if no label exists
 */
export function getLayerLabel(layer: MapLayer): string {
  return layer.label || 'Couche sans titre'
}

export function getLayerError(layer: MapLayer): string {
  if (layer.error) {
    if (isStacLayer(layer)) {
      return 'Erreur lors du chargement des données STAC. Vérifiez les filtres appliqués ou la connexion au serveur.'
    }
    return 'Erreur lors du chargement de la couche.'
  }
  return ''
}
