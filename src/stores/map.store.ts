import { computed, ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { MapContext, MapContextLayer, MapContextView } from '@geospatial-sdk/core'
import { removeLayerFromContext } from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'

export const useMapStore = defineStore('map', () => {
  const context: Ref<MapContext> = ref<MapContext>(DEFAULT_MAP_CONTEXT)

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

  function setView(view: MapContextView) {
    context.value = {
      ...context.value,
      view,
    }
  }

  function addLayer(layer: MapContextLayer) {
    context.value = {
      ...context.value,
      layers: [...context.value.layers, layer],
    }
  }

  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value, layer)
  }

  return {
    context,
    layers,
    view,
    setView,
    addLayer,
    deleteLayer,
  }
})
