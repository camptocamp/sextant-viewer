import type { MapLayerStac } from '@/types/stac.types'
import type { ExtendedMapLayerWms } from '@/types/wms.types'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Union type combining standard MapContext layers with STAC and typed-extras WMS layers, so viewer
 * code reads `extras` without casting (the SDK types `extras` values as `unknown`).
 */
export type MapLayer = (MapContextLayer | MapLayerStac | ExtendedMapLayerWms) & {
  error?: boolean
}

/** Whether a WMS layer is backed by a Geonetwork data index (its `extras.dataIndex` is set). */
export function isLayerDataIndexed(layer: MapLayer): boolean {
  return layer.type === 'wms' && !!(layer.extras as ExtendedMapLayerWms['extras'])?.dataIndex
}

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
