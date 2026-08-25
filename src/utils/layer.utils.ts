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

/** Narrows a layer to the typed-extras WMS shape so `extras.dataIndex` / `extras.filter` read out. */
export function isWmsLayer(layer: MapLayer): layer is ExtendedMapLayerWms {
  return layer.type === 'wms'
}

/** Whether a WMS layer is backed by a Geonetwork data index (its `extras.dataIndex` is set). */
export function isLayerDataIndexed(layer: MapLayer): layer is ExtendedMapLayerWms {
  return isWmsLayer(layer) && !!layer.extras?.dataIndex
}

/** Whether a WMS layer's record declares WPS processes (its `extras.wpsProcesses` is set). */
export function hasLayerWps(layer: MapLayer): layer is ExtendedMapLayerWms {
  return isWmsLayer(layer) && !!layer.extras?.wpsProcesses?.length
}

/**
 * For a WMS layer carrying app-only extras (`dataIndex`, `filter` or `wpsProcesses`), encode its
 * active selections (`extras.filter`) as the layer's `filter` (the SDK forwards it verbatim to the
 * WMS `FILTER` GetMap param and resets it when it disappears) and strip those extras before handing
 * the layer to the SDK. Other layers pass through unchanged — in particular a consumer-supplied
 * `customParams.FILTER` is never touched.
 */
export function applyWmsFilter(layer: MapContextLayer): MapContextLayer {
  if (!isWmsLayer(layer)) return layer

  const wmsExtras = layer.extras
  if (!wmsExtras?.dataIndex && !wmsExtras?.filter && !wmsExtras?.wpsProcesses) return layer
  const filterParam = buildWmsFilterParam(layer.name, wmsExtras.filter ?? [])

  const extras = { ...layer.extras }
  delete extras.filter
  delete extras.dataIndex
  delete extras.wpsProcesses

  return { ...layer, extras, ...(filterParam && { filter: filterParam }) }
}

/**
 * Strip the app-only attribute-filter extras (`dataIndex`, the internal ES connection, and
 * `filter`, the active selections) so `getContext()` doesn't expose them to consumers.
 * `dataIndex` is re-derived by detection when a context is re-applied.
 */
export function stripAttributeFilterExtras(layer: MapLayer): MapLayer {
  if (!isWmsLayer(layer)) return layer
  const extras = { ...layer.extras }
  if (!extras.dataIndex && !extras.filter) return layer
  delete extras.dataIndex
  delete extras.filter
  return { ...layer, extras }
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
