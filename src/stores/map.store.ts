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
import type { MapLayer } from '@/utils/layer.utils'
import { isStacLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'

export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
}

export const useMapStore = defineStore('map', () => {
  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>({
    view: DEFAULT_MAP_CONTEXT.view || {
      center: [0, 0] as [number, number],
      zoom: 2,
    },
    layers: DEFAULT_MAP_CONTEXT.layers || [],
  })

  const currentExtent = ref<[number, number, number, number] | undefined>(undefined)

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)
  const initialMapView = computed(() => DEFAULT_MAP_CONTEXT.view)

  const sdkContext = computed<MapContext>(() => ({
    view: context.value.view,
    layers: context.value.layers
      .filter((layer) => !isStacLayer(layer) || layer.data)
      .map((layer) => {
        if (isStacLayer(layer)) {
          return fromStacToGeojsonLayer(layer)
        }
        return layer as MapContextLayer
      }),
  }))

  function setContext(newContext: ExtendedMapContext) {
    context.value = newContext
  }

  function setView(newView: MapContextView) {
    context.value = {
      ...context.value,
      view: { ...newView },
    }
  }

  function resetView() {
    context.value = {
      ...context.value,
      view: { ...initialMapView.value } as MapContextView,
    }
  }

  function setViewExtent(extent: [number, number, number, number]) {
    currentExtent.value = extent
  }

  function addLayer(layer: MapLayer) {
    const versionedLayer = { ...layer, version: 0 } // we're tracking changes on layers by version
    context.value = addLayerToContext(
      context.value as MapContext,
      versionedLayer as MapContextLayer,
    ) as ExtendedMapContext
  }

  function deleteLayer(layer: MapLayer): void {
    context.value = removeLayerFromContext(
      context.value as MapContext,
      layer as MapContextLayer,
    ) as ExtendedMapContext
  }

  function changeLayerPosition(layer: MapLayer, delta: number) {
    const oldPosition = getLayerPosition(context.value as MapContext, layer as MapContextLayer)
    const newPosition = oldPosition + delta
    context.value = changeLayerPositionInContext(
      context.value as MapContext,
      layer as MapContextLayer,
      newPosition,
    ) as ExtendedMapContext
  }

  function updateLayer(layer: MapLayer, updates: Partial<MapLayer>) {
    context.value = updateLayerInContext(
      context.value as MapContext,
      layer as MapContextLayer,
      updates as Partial<MapContextLayer>,
    ) as ExtendedMapContext
  }

  function fromStacToGeojsonLayer(layer: MapLayerStac): MapContextLayer {
    return {
      type: 'geojson',
      id: layer.id,
      label: layer.label,
      opacity: layer.opacity ?? 1,
      visibility: layer.visibility ?? true,
      version: layer.version,
      data: layer.data,
    } as MapContextLayer
  }

  return {
    context,
    sdkContext,
    layers,
    view,
    initialMapView,
    currentExtent,
    setContext,
    setView,
    resetView,
    setViewExtent,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    fromStacToGeojsonLayer,
  }
})
