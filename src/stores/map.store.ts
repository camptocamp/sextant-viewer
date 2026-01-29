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
  updateLayerInContext,
} from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'

export const useMapStore = defineStore('map', () => {
  const context: Ref<MapContext> = ref<MapContext>(DEFAULT_MAP_CONTEXT)

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

  function setContext(newContext: MapContext) {
    context.value = newContext
  }

  function setView(view: MapContextView) {
    context.value = {
      ...context.value,
      view,
    }
  }

  function addLayer(layer: MapContextLayer) {
    const versionedLayer = { ...layer, version: 0 } // we're tracking changes on layers by version
    context.value = addLayerToContext(context.value, versionedLayer)
  }

  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value, layer)
  }

  function changeLayerPosition(layer: MapContextLayer, delta: number) {
    const oldPosition = getLayerPosition(context.value, layer)
    const newPosition = oldPosition + delta
    context.value = changeLayerPositionInContext(context.value, layer, newPosition)
  }

  function updateLayer(layer: MapContextLayer, updates: Partial<MapContextLayer>) {
    context.value = updateLayerInContext(context.value, layer, updates)
  }

  return {
    context,
    layers,
    view,
    setContext,
    setView,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
  }
})
