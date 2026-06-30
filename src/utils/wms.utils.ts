import {
  getDimensionDefaultValue,
  WmsEndpoint,
  type WmsLayerDimension,
} from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import type { MapLayer } from './layer.utils'

export function getWmsTimeDimension(layer: MapLayer): WmsLayerDimension | null {
  if (layer.type !== 'wms') return null
  const dims = (layer.extras?.wmsDimensions as WmsLayerDimension[]) ?? []
  return dims.find((d) => d.name.toLowerCase() === 'time') ?? null
}

/** Non-time dimensions declared by the server (elevation, band, …). */
export function getWmsOtherDimensions(layer: MapLayer): WmsLayerDimension[] {
  if (layer.type !== 'wms') return []
  const dims = (layer.extras?.wmsDimensions as WmsLayerDimension[]) ?? []
  return dims.filter((d) => d.name.toLowerCase() !== 'time')
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
 * Enrich a WMS layer with the dimensions the server declares (TIME, ELEVATION, …).
 * Stores all dimensions in `extras.wmsDimensions`, then seeds `dimensionValues`
 * from each dimension's server default.
 * Returns the layer unchanged when it declares no dimensions
 */
export async function enrichWmsDimensionsLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.wmsDimensions) return layer

  try {
    const endpoint = new WmsEndpoint((layer as { url: string }).url)
    await endpoint.isReady()
    const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
    const dims = layerInfo?.dimensions ?? []
    if (dims.length === 0) return layer

    // WMS dimension names are case-insensitive; servers may emit TIME, Time, etc.
    const timeDim = dims.find((d) => d.name.toLowerCase() === 'time')

    const wmsLayer = layer as MapContextLayerWms
    const existing = wmsLayer.dimensionValues ?? {}
    const seeded: NonNullable<MapContextLayerWms['dimensionValues']> = { ...existing }
    for (const dim of dims) {
      const key = dim.name.toUpperCase()
      // Preserve a consumer-provided value as-is.
      if (seeded[key]) continue
      if (dim === timeDim) {
        const defaultTime = getDefaultWmsTime(dim)
        if (defaultTime) seeded[key] = toWmsTime(defaultTime)
      } else {
        const def = getDimensionDefaultValue(dim)
        if (def) seeded[key] = String(def)
      }
    }

    return {
      ...layer,
      extras: {
        ...layer.extras,
        wmsDimensions: dims,
      },
      ...(Object.keys(seeded).length > 0 && { dimensionValues: seeded }),
    }
  } catch (err) {
    console.error('WMS dimension enrichment failed', err)
    return layer
  }
}
