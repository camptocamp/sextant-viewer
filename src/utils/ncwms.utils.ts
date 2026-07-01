import { NcwmsEndpoint } from '@camptocamp/ogc-client'
import type { NcwmsLayerDetails } from '@camptocamp/ogc-client'
import type { MapLayer } from './layer.utils'

export function buildNcwmsStyles(info: NcwmsLayerDetails): Record<string, string> {
  const styles: Record<string, string> = {}
  for (const style of info.supportedStyles) {
    if (style === 'boxfill') {
      for (const palette of info.palettes) {
        styles[palette] = `boxfill/${palette}`
      }
    } else {
      styles[style] = style
    }
  }
  return styles
}

export async function enrichNcwmsLayer(layer: MapLayer): Promise<MapLayer> {
  if (layer.type !== 'wms' || layer.extras?.ncwmsInfo) return layer

  try {
    const endpoint = new NcwmsEndpoint(layer.url)
    const ncwmsInfo = await endpoint.getLayerDetails(layer.name)
    if (!ncwmsInfo) return layer
    const defaultPalette = ncwmsInfo.defaultPalette ?? ncwmsInfo.palettes[0]
    const styles = buildNcwmsStyles(ncwmsInfo)
    return {
      ...layer,
      style: layer.style ?? (defaultPalette ? styles[defaultPalette] : undefined),
      customParams: {
        COLORSCALERANGE: `${ncwmsInfo.scaleRange[0]},${ncwmsInfo.scaleRange[1]}`,
        LOGSCALE: 'false',
        ...layer.customParams,
      },
      extras: { ...layer.extras, ncwmsInfo },
    }
  } catch (err) {
    console.error('NcWMS enrichment failed', err)
    return layer
  }
}

export function getNcwmsInfo(layer: MapLayer): NcwmsLayerDetails | null {
  if (layer.type !== 'wms') return null
  return (layer.extras?.ncwmsInfo as NcwmsLayerDetails) ?? null
}
