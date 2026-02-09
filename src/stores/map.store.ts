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
  type Extent,
} from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'
import type { MapLayer } from '@/utils/layer.utils'
import { isStacLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import { computedAsync } from '@vueuse/core'
import { enrichStacLayer } from '@/utils/stac.utils'
import { v4 as uuidv4 } from 'uuid';

const FALLBACK_VIEW: MapContextView = {
  center: [0, 0] as [number, number],
  zoom: 2,
}
export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
}

export const useMapStore = defineStore('map', () => {
  const initialContext = ref<ExtendedMapContext>(DEFAULT_MAP_CONTEXT)

  const initialEnrichedContext: Ref<ExtendedMapContext> = computedAsync<ExtendedMapContext>(
    async () => {
      const enrichedLayers = await Promise.all(
        initialContext.value.layers.map(async (layer) => {
          if (isStacLayer(layer)) {
            return (await enrichStacLayer(layer)) as MapLayerStac
          }
          return layer
        }),
      )
      return {
        ...initialContext.value,
        view: initialContext.value.view,
        layers: enrichedLayers,
      }
    },
  ) as Ref<ExtendedMapContext>

  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>(initialContext.value)

  const currentExtent = ref<Extent | null>(null)

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

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

  function setInitialContext(newContext: ExtendedMapContext) {
    initialContext.value = newContext
  }

  function setContext(newContext: ExtendedMapContext) {
    const layersWithVersionAndId = newContext.layers.map(layer => ({
      ...layer,
      id: layer.id ? layer.id : uuidv4(),
      version: layer.version !== undefined ? layer.version : 0,
    }))

    context.value = {
      ...newContext,
      layers: layersWithVersionAndId,
    }
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
      view: { ...(initialContext.value.view || FALLBACK_VIEW) } as MapContextView,
    }
  }

  function setCurrentViewExtent(extent: Extent) {
    currentExtent.value = extent
  }

  function addLayer(layer: MapLayer): number | string {
    const versionedLayer = {
      ...layer,
      id: layer.id ? layer.id : uuidv4(),
      version: 0, // we're tracking changes on layers by version
    }

    context.value = addLayerToContext(
      context.value as MapContext,
      versionedLayer as MapContextLayer,
    ) as ExtendedMapContext

    return versionedLayer.id
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

  function getLayerById(id: string | number): MapLayer | undefined {
    return context.value.layers.find(layer => layer.id === id)
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
    initialContext,
    initialEnrichedContext,
    layers,
    view,
    currentExtent,
    setInitialContext,
    setContext,
    setView,
    resetView,
    setCurrentViewExtent,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    getLayerById,
    fromStacToGeojsonLayer,
  }
})
