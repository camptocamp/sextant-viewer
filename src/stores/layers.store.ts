import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MapLayer } from '@/utils/layer.utils'
import { useMapStore } from './map.store'

/**
 * Layers store - manages layer selection state
 *
 * Stores the layer ID (not the full object) to avoid stale references.
 * The actual layer object is retrieved from the map context on demand.
 */
export const useLayersStore = defineStore('layers', () => {
  const selectedLayerId = ref<string | null>(null)
  const mapStore = useMapStore()

  const selectedLayer = computed<MapLayer | null>(() => {
    if (!selectedLayerId.value) return null
    return mapStore.layers.find((layer) => String(layer.id) === selectedLayerId.value) ?? null
  })

  const hasSelection = computed(() => selectedLayerId.value !== null)

  const selectLayer = (layer: MapLayer) => {
    selectedLayerId.value = layer.id ? String(layer.id) : null
  }

  const deselectLayer = () => {
    selectedLayerId.value = null
  }

  return {
    selectedLayer,
    hasSelection,
    selectLayer,
    deselectLayer,
  }
})
