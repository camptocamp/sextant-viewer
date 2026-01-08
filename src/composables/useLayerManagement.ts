import { computed, type ComputedRef } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { isBasemapLayer, getLayerLabel } from '@/utils/layer.utils'
import type { MapContextLayer } from '@geospatial-sdk/core'
import type { DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'

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
    const filtered = mapStore.layers.filter((layer) => !isBasemapLayer(layer))
    return [...filtered].reverse()
  })

  const handleDeleteLayer = (layer: MapContextLayer): void => {
    mapStore.deleteLayer(layer)
  }

  /**
   * Generate context menu items for a layer
   */
  const getMenuItems = (layer: MapContextLayer): DropdownMenuItem[][] => {
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
