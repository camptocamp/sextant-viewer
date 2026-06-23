import { WmsEndpoint } from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { getDefaultWmsTime, type MapLayer } from './layer.utils'

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
    const seedTime = wmsLayer.dimensionValues?.TIME ?? getDefaultWmsTime(timeDim)
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
