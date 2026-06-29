import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { type MapLayer } from '@/utils/layer.utils'
import { buildNcwmsStyles, getNcwmsInfo } from '@/utils/ncwms.utils'
import { NcwmsEndpoint } from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'

export function useNcwmsLayer(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const ncwmsInfo = computed(() => getNcwmsInfo(toValue(layer)))
  const styles = computed(() => buildNcwmsStyles(ncwmsInfo.value!))

  const palette = computed<string>({
    get: () => {
      const style = (toValue(layer) as MapContextLayerWms).style ?? ''
      return style.includes('/') ? (style.split('/')[1] ?? '') : style
    },
    set: (value: string) =>
      mapStore.updateLayer(toValue(layer), {
        style: styles.value[value],
      } as Partial<MapLayer>),
  })

  const logScale = computed<boolean>({
    get: () => (toValue(layer) as MapContextLayerWms).customParams?.LOGSCALE === 'true',
    set: (value) => updateCustomParam({ LOGSCALE: String(value) }),
  })

  const colorScaleRange = computed<[number, number]>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).customParams?.COLORSCALERANGE ?? ''
      const [min, max] = raw.split(',').map(Number)
      return [min ?? 0, max ?? 1] as [number, number]
    },
    set: ([min, max]: [number, number]) => updateCustomParam({ COLORSCALERANGE: `${min},${max}` }),
  })

  function updateCustomParam(patch: Record<string, string>) {
    const l = toValue(layer) as MapContextLayerWms
    mapStore.updateLayer(
      l as MapLayer,
      {
        customParams: { ...l.customParams, ...patch },
      } as Partial<MapLayer>,
    )
  }

  async function autoColorRange(extent: [number, number, number, number]) {
    const l = toValue(layer) as MapContextLayerWms
    const bounds = await new NcwmsEndpoint(l.url).getMinMax(l.name, extent, {
      time: l.dimensionValues?.TIME
        ? l.dimensionValues.TIME instanceof Date
          ? l.dimensionValues.TIME.toISOString()
          : String(l.dimensionValues.TIME)
        : undefined,
      elevation: l.dimensionValues?.ELEVATION ? String(l.dimensionValues.ELEVATION) : undefined,
    })
    colorScaleRange.value = [bounds.min, bounds.max]
  }

  const legendUrl = computed(() => {
    const l = toValue(layer) as MapContextLayerWms
    return new NcwmsEndpoint(l.url).getLegendUrl(l.name, {
      style: l.style,
      colorScaleRange: colorScaleRange.value,
      logScale: logScale.value,
    })
  })

  return { ncwmsInfo, styles, palette, logScale, colorScaleRange, autoColorRange, legendUrl }
}
