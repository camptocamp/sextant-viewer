import { WmsEndpoint, WmtsEndpoint } from '@camptocamp/ogc-client'
import type { MapContextLayerWms, MapContextLayerWmts } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import { isWmsLayer, isWmtsLayer } from '@/utils/layer.utils'

/**
 * Resolves the legend image URL for a WMS or WMTS layer from its service capabilities.
 *
 * For WMS, falls back to a built GetLegendGraphic request when the capabilities advertise
 * no legend URL. WMTS has no such fallback. Returns undefined for any other layer type or
 * on error (never throws).
 */
export async function resolveLegendUrl(layer: MapLayer): Promise<string | undefined> {
  try {
    if (isWmsLayer(layer)) {
      return await resolveWmsLegendUrl(layer as MapContextLayerWms)
    }
    if (isWmtsLayer(layer)) {
      return await resolveWmtsLegendUrl(layer as MapContextLayerWmts)
    }
  } catch (error) {
    console.error('Failed to resolve legend URL for layer', layer, error)
  }
  return undefined
}

async function resolveWmsLegendUrl(layer: MapContextLayerWms): Promise<string | undefined> {
  const endpoint = await new WmsEndpoint(layer.url).isReady()
  const layerInfo = endpoint.getLayerByName(layer.name)
  const style = layerInfo?.styles?.find((s) => s.name === layer.style) ?? layerInfo?.styles?.[0]

  if (style?.legendUrl) {
    return style.legendUrl
  }

  return buildGetLegendGraphicUrl(layer.url, layer.name, endpoint.getVersion(), layer.style)
}

async function resolveWmtsLegendUrl(layer: MapContextLayerWmts): Promise<string | undefined> {
  const endpoint = await new WmtsEndpoint(layer.url).isReady()
  const layerInfo = endpoint.getLayerByName(layer.name)
  const style =
    layerInfo?.styles?.find((s) => s.name === (layer.style ?? layerInfo.defaultStyle)) ??
    layerInfo?.styles?.[0]

  return style?.legendUrl
}

function buildGetLegendGraphicUrl(
  baseUrl: string,
  layerName: string,
  version: string,
  style?: string,
): string {
  const url = new URL(baseUrl)
  url.searchParams.set('SERVICE', 'WMS')
  url.searchParams.set('VERSION', version)
  url.searchParams.set('REQUEST', 'GetLegendGraphic')
  url.searchParams.set('FORMAT', 'image/png')
  url.searchParams.set('LAYER', layerName)
  if (style) {
    url.searchParams.set('STYLE', style)
  }
  return url.toString()
}
