import { computed, type ComputedRef } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { getLayerLabel, isBasemapLayer } from '@/utils/layer.utils'
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayerReordering } from './useLayerReordering'

export function useLayerManagement() {
  const mapStore = useMapStore()

  const dataLayers: ComputedRef<MapContextLayer[]> = computed(() => {
    const filtered = mapStore.layers.filter((layer) => !isBasemapLayer(layer))
    return [...filtered].reverse()
  })

  const { sortableRef, isDragging } = useLayerReordering(dataLayers)

  const handleDeleteLayer = (layer: MapContextLayer): void => {
    mapStore.deleteLayer(layer)
  }

  const getLabel = (layer: MapContextLayer): string => {
    return getLayerLabel(layer)
  }

  return {
    dataLayers,
    handleDeleteLayer,
    getLabel,
    sortableRef,
    isDragging,
  }
}
