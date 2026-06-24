import {
  getDimensionDefaultValue,
  WmsEndpoint,
  type WmsLayerDimension,
} from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import type { MapLayer } from './layer.utils'

export function getWmsTimeDimension(layer: MapLayer): WmsLayerDimension | null {
  if (layer.type !== 'wms') return null
  return (layer.extras?.wmsTimeDimension as WmsLayerDimension) ?? null
}

/**
 * Resolve the TIME value a layer should default to, as a Date.
 * Delegates the WMS semantics to ogc-client; returns null if unparseable.
 */
export function getDefaultWmsTime(dim: WmsLayerDimension): Date | null {
  const candidate = getDimensionDefaultValue(dim)
  if (!candidate) return null
  const d = new Date(candidate)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format a Date as ISO 8601 without milliseconds ("2026-06-24T03:00:00Z").
 * Some WMS servers (e.g. GeoMet) reject the ".000" that Date.toISOString() emits.
 * Stored as a string so the SDK forwards it verbatim rather than re-serializing.
 */
export function toWmsTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Enrich a WMS layer with its TIME dimension, if the server declares one.
 * Stores the dimension in `extras.wmsTimeDimension` and seeds `dimensionValues.TIME`
 * with the server default (never overwriting a consumer-provided value), so the
 * selector reflects what a GetMap without TIME renders.
 * Returns the layer unchanged when it has no TIME dimension; enrichment failure
 * is non-fatal and the original layer is returned.
 */
export async function enrichWmsTimeLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.wmsTimeDimension) return layer

  try {
    const endpoint = new WmsEndpoint((layer as { url: string }).url)
    await endpoint.isReady()
    const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
    // WMS dimension names are case-insensitive; servers may emit TIME, Time, etc.
    const timeDim = layerInfo?.dimensions?.find((d) => d.name.toLowerCase() === 'time')
    if (!timeDim) return layer

    const wmsLayer = layer as MapContextLayerWms
    // Preserve a consumer-provided TIME as-is; only normalize our own default to
    // the millisecond-free format WMS servers expect (see toWmsTime).
    const defaultTime = getDefaultWmsTime(timeDim)
    const seedTime = wmsLayer.dimensionValues?.TIME ?? (defaultTime && toWmsTime(defaultTime))
    return {
      ...layer,
      extras: { ...layer.extras, wmsTimeDimension: timeDim },
      ...(seedTime && {
        dimensionValues: { ...wmsLayer.dimensionValues, TIME: seedTime },
      }),
    }
  } catch (err) {
    console.error('WMS time dimension enrichment failed', err)
    return layer
  }
}
