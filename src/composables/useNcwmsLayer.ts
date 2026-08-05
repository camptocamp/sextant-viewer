import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { type MapLayer } from '@/utils/layer.utils'
import { buildNcwmsStyles, getNcwmsInfo } from '@/utils/ncwms.utils'
import { NcwmsEndpoint } from '@camptocamp/ogc-client'
import type { MapContextLayerWms } from '@geospatial-sdk/core'
import { toWmsTime } from '@/utils/wms.utils'

export function useNcwmsLayer(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const ncwmsInfo = computed(() => getNcwmsInfo(toValue(layer)))
  const styles = computed(() => (ncwmsInfo.value ? buildNcwmsStyles(ncwmsInfo.value) : {}))

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
      return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 1] as [number, number]
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
    const timeValue = l.dimensionValues?.TIME
    const timeStr = timeValue instanceof Date ? toWmsTime(timeValue) : String(timeValue)
    const bounds = await new NcwmsEndpoint(l.url).getMinMax(l.name, extent, {
      time: timeValue ? timeStr : undefined,
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
