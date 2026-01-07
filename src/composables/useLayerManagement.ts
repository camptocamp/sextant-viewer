import { computed, type ComputedRef } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { isBasemapLayer, getLayerLabel, type LayerMenuItem } from '@/types/layer'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Composable for layer management functionality
 * Provides layer filtering, ordering, and deletion capabilities
 */
export function useLayerManagement() {
  const mapStore = useMapStore()

  /**
   * Compute non-basemap layers in reverse order (most visible first)
   */
  const dataLayers: ComputedRef<MapContextLayer[]> = computed(() => {
    const filtered = mapStore.layers.filter((layer, index) => !isBasemapLayer(layer, index))
    return [...filtered].reverse()
  })

  const handleDeleteLayer = (layer: MapContextLayer): void => {
    mapStore.deleteLayer(layer)
  }

  /**
   * Generate context menu items for a layer
   */
  const getMenuItems = (layer: MapContextLayer): LayerMenuItem[][] => {
    return [
      [
        {
          label: 'Delete layer',
          class: 'text-red-400',
          onSelect: () => handleDeleteLayer(layer),
        },
      ],
    ]
  }

  /**
   * Get display label for a layer
   */
  const getLabel = (layer: MapContextLayer): string => {
    return getLayerLabel(layer)
  }

  return {
    dataLayers,
    handleDeleteLayer,
    getMenuItems,
    getLabel,
  }
}
