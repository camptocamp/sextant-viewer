import { useMapStore } from '@/stores/map.store'
import { useLayerActions } from '@/composables/useLayerActions'
import type { MapContextLayer } from '@geospatial-sdk/core'

export function useAddLayer() {
  const mapStore = useMapStore()

  const addLayer = async (layer: MapContextLayer, zoomToExtent = false) => {
    const enrichedLayer = await mapStore.addLayer(layer)
    const { canZoomToExtent, zoomToExtent: zoomToLayerExtent } = useLayerActions(
      () => enrichedLayer,
    )
    if (zoomToExtent && canZoomToExtent.value) {
      zoomToLayerExtent()
    }
    return enrichedLayer
  }

  return { addLayer }
}
