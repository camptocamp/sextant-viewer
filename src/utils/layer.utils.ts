import type { MapLayerStac } from '@/types/stac.types'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { AttributeFilterState } from '@/types/attribute-filter.types'

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

/**
 * Return the attribute-filter state of a WMS layer, when present and valid. The state is set on
 * `extras.attributeFilter` by detection (see `attributeFilterDetection.ts`); the presence of a
 * resolved ES source is what "detects" that a filterable index is available.
 */
export function getAttributeFilterState(layer: MapLayer): AttributeFilterState | undefined {
  if (layer.type !== 'wms') return undefined
  const state = (layer.extras as { attributeFilter?: AttributeFilterState } | undefined)
    ?.attributeFilter
  return state?.source?.url ? state : undefined
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
