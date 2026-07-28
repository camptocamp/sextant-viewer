import type { MapLayerStac } from '@/types/stac.types'
import type { ExtendedMapLayerWms } from '@/types/wms.types'
import type { MapContextLayer } from '@geospatial-sdk/core'
import { buildWmsFilterParam } from './wms.utils'

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
 * For a WMS layer, encode its active selections (`extras.filter`) as the WMS `FILTER` GetMap param
 * (an OGC Filter, passed through `customParams`) and strip the app-only `extras` before handing the
 * layer to the SDK. Other layers pass through unchanged.
 *
 * `FILTER` is removed from `customParams` when no selection is active, otherwise a stale filter
 * would persist — the SDK diffs `customParams` by key, so an omitted key is not a cleared key.
 */
export function applyWmsFilter(layer: MapContextLayer): MapContextLayer {
  if (layer.type !== 'wms') return layer
  const wmsExtras = layer.extras as ExtendedMapLayerWms['extras']
  const filterParam = buildWmsFilterParam(layer.name, wmsExtras?.filter ?? [])

  const extras = { ...layer.extras }
  delete extras.filter
  delete extras.dataIndex

  const customParams = { ...layer.customParams }
  if (filterParam) customParams.FILTER = filterParam
  else delete customParams.FILTER

  return { ...layer, customParams, extras }
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
