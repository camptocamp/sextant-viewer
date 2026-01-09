import { computed, ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addLayerToContext,
  changeLayerPositionInContext,
  getLayerPosition,
  type MapContext,
  type MapContextLayer,
  type MapContextView,
  removeLayerFromContext,
} from '@geospatial-sdk/core'
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
    context.value = addLayerToContext(context.value, layer)
  }

  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value, layer)
  }

  function changeLayerPosition(layer: MapContextLayer, delta: number) {
    const oldPosition = getLayerPosition(context.value, layer)
    const newPosition = oldPosition + delta
    context.value = changeLayerPositionInContext(context.value, layer, newPosition)
  }

  return {
    context,
    layers,
    view,
    setView,
    addLayer,
    deleteLayer,
    changeLayerPosition,
  }
})
