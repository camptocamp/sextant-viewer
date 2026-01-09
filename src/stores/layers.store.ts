import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Layers store - manages layer selection state
 *
 * Stores the full MapContextLayer object (not just ID) for the selected layer.
 * Provides actions to select, deselect, and toggle layer selection.
 */
export const useLayersStore = defineStore('layers', () => {
  const selectedLayer = ref<MapContextLayer | null>(null)
  const hasSelection = computed(() => selectedLayer.value !== null)

  const selectLayer = (layer: MapContextLayer) => {
    selectedLayer.value = layer
  }

  const deselectLayer = () => {
    selectedLayer.value = null
  }

  return {
    selectedLayer,
    hasSelection,
    selectLayer,
    deselectLayer,
  }
})
