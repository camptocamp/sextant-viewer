import { useMapStore } from '@/stores/map.store'
import type { MapLayer } from '@/utils/layer.utils'
import { isStacLayer } from '@/utils/layer.utils'
import { createViewFromLayer } from '@geospatial-sdk/core'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'

export function useLayerActions(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const opacity = computed({
    get: () => Math.floor((toValue(layer).opacity ?? 1) * 100),
    set: (value: number) => {
      mapStore.updateLayer(toValue(layer), { opacity: value / 100 })
    },
  })

  const isVisible = computed({
    get: () => toValue(layer).visibility !== false,
    set: (value: boolean) => {
      mapStore.updateLayer(toValue(layer), { visibility: value })
    },
  })

  function toggleVisibility() {
    isVisible.value = !isVisible.value
  }

  const canZoomToExtent = computed(() => {
    const l = toValue(layer)
    if (l.type === 'geojson') return !!l.data
    if (l.type === 'stac') return !!l.data
    return ['wms', 'wmts', 'wfs', 'geotiff'].includes(l.type)
  })

  async function zoomToExtent() {
    const l = toValue(layer)
    const mapContextLayer = isStacLayer(l) ? mapStore.fromStacToGeojsonLayer(l) : l

    try {
      const view = await createViewFromLayer(mapContextLayer)
      if (view) {
        mapStore.setView(view)
      }
    } catch (error) {
      console.error('Error getting layer extent:', error)
    }
  }

  function deleteLayer() {
    mapStore.deleteLayer(toValue(layer))
  }

  return {
    opacity,
    isVisible,
    toggleVisibility,
    canZoomToExtent,
    zoomToExtent,
    deleteLayer,
  }
}
