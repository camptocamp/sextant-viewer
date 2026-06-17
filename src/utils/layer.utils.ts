import type { MapLayerStac } from '@/types/stac.types'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { WmsLayerDimension } from '@camptocamp/ogc-client'

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
 * Get display label for a layer with fallback
 * @param layer - The layer to get label from
 * @returns Layer label or 'Untitled Layer' if no label exists
 */
export function getLayerLabel(layer: MapLayer): string {
  return layer.label || 'Couche sans titre'
}

export function getWmsTimeDimension(layer: MapLayer): WmsLayerDimension | null {
  if (layer.type !== 'wms') return null
  return (layer.extras?.wmsTimeDimension as WmsLayerDimension) ?? null
}

/**
 * Resolve the TIME value a layer should default to: the server's declared
 * default, otherwise the first allowed value (the start of an interval, if the
 * value is expressed as "start/end/period"). Returns null if none is parseable.
 */
export function getDefaultWmsTime(dim: WmsLayerDimension): Date | null {
  const candidate = dim.defaultValue || dim.values[0]?.split('/')[0]
  if (!candidate) return null
  const d = new Date(candidate)
  return isNaN(d.getTime()) ? null : d
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
