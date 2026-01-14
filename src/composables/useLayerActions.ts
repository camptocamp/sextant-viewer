import type { MapContextLayer } from '@geospatial-sdk/core'
import { createViewFromLayer } from '@geospatial-sdk/core'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMapStore } from '@/stores/map.store'

export function useLayerActions(layer: MaybeRefOrGetter<MapContextLayer>) {
  const mapStore = useMapStore()

  const opacity = computed({
    get: () => Math.floor((toValue(layer).opacity ?? 1) * 100),
    set: (value: number) => {
      mapStore.updateLayer(toValue(layer), { opacity: value / 100 })
    },
  })

  const canZoomToExtent = computed(() => {
    const l = toValue(layer)
    if (l.type === 'geojson') return !!l.data
    return ['wms', 'wmts', 'wfs'].includes(l.type)
  })

  async function zoomToExtent() {
    try {
      const view = await createViewFromLayer(toValue(layer))
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
    canZoomToExtent,
    zoomToExtent,
    deleteLayer,
  }
}
