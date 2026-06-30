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
  type ResolvedMapState,
  type ResolvedMapLayerState,
} from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'
import type { MapLayer } from '@/utils/layer.utils'
import { isStacLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import { enrichStacLayer } from '@/utils/stac.utils'
import { enrichWmsDimensionsLayer } from '@/utils/wms.utils'
import { v4 as uuidv4 } from 'uuid'
import type { ExtendedMapContext } from '@/types/map.types'

export type { ExtendedMapContext }

const FALLBACK_VIEW: MapContextView = {
  center: [0, 0] as [number, number],
  zoom: 2,
}

export const useMapStore = defineStore('map', () => {
  const initialContext = ref<ExtendedMapContext>(DEFAULT_MAP_CONTEXT)

  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>(initialContext.value)

  const backgroundLayers = computed<MapLayer[]>(
    () => context.value.backgroundLayers ?? DEFAULT_MAP_CONTEXT.backgroundLayers,
  )
  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

  const mapState = ref<ResolvedMapState>({ layers: [], view: null })
  const currentExtent = computed<Extent | null>(() => mapState.value.view?.extent ?? null)
  const layerStates = computed(() => {
    const states: Record<string | number, ResolvedMapLayerState> = {}
    for (const state of mapState.value.layers) {
      if (state?.id !== undefined) {
        states[state.id] = state
      }
    }
    return states
  })

  const sdkContext = computed<MapContext>(() => ({
    view: context.value.view,
    layers: [
      ...(backgroundLayers.value.filter((l) => l.visibility !== false) as MapContextLayer[]),
      ...context.value.layers
        .filter((layer) => !isStacLayer(layer) || layer.data)
        .map((layer) => {
          if (isStacLayer(layer)) {
            return fromStacToGeojsonLayer(layer)
          }
          return layer as MapContextLayer
        }),
    ],
  }))

  async function enrichLayer(layer: MapLayer): Promise<MapLayer> {
    const layerWithVersionAndId = {
      ...layer,
      id: layer.id || uuidv4(),
      version: layer.version ?? 0,
    }

    if (isStacLayer(layer)) {
      const enriched = await enrichStacLayer(layerWithVersionAndId as MapLayerStac)
      return enriched ?? layerWithVersionAndId
    }

    return enrichWmsDimensionsLayer(layerWithVersionAndId)
  }

  async function enrichContext(context: ExtendedMapContext): Promise<ExtendedMapContext> {
    return {
      ...context,
      layers: await Promise.all((context.layers ?? []).map(enrichLayer)),
      backgroundLayers: await Promise.all((context.backgroundLayers ?? []).map(enrichLayer)),
    }
  }

  async function setInitialContext(newContext: ExtendedMapContext, apply: boolean = false) {
    initialContext.value = newContext
    if (apply) {
      setContext(initialContext.value)
    }
  }

  async function setContext(newContext: ExtendedMapContext) {
    context.value = {
      ...(await enrichContext(newContext)),
      view: { ...newContext.view }, // Force view application if same as current value
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

  function setMapState(newState: ResolvedMapState) {
    mapState.value = newState
  }

  function selectBackgroundLayer(id: string) {
    context.value = {
      ...context.value,
      backgroundLayers: backgroundLayers.value.map((l) => ({
        ...l,
        visibility: l.id?.toString() === id,
      })),
    }
  }

  async function addLayer(layer: MapLayer): Promise<MapLayer> {
    const enrichedLayer = await enrichLayer(layer)

    context.value = addLayerToContext(
      context.value as MapContext,
      enrichedLayer as MapContextLayer,
    ) as ExtendedMapContext

    return enrichedLayer
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
    return context.value.layers.find((layer) => layer.id === id)
  }

  const cleanLayers = (toClean: MapLayer[]) =>
    toClean.map(({ id: _id, version: _version, ...rest }) => rest)

  function getContext(): ExtendedMapContext {
    return {
      layers: cleanLayers(layers.value),
      backgroundLayers: cleanLayers(backgroundLayers.value),
      view: { extent: currentExtent.value! },
    }
  }

  function fromStacToGeojsonLayer(layer: MapLayerStac): MapContextLayer {
    return {
      type: 'geojson',
      id: layer.id,
      label: layer.label,
      opacity: layer.opacity ?? 1,
      visibility: layer.visibility ?? true,
      hoverable: layer.hoverable,
      version: layer.version,
      data: layer.data,
    } as MapContextLayer
  }

  return {
    context,
    sdkContext,
    initialContext,
    layers,
    layerStates,
    view,
    currentExtent,
    backgroundLayers,
    setInitialContext,
    setContext,
    setView,
    resetView,
    setMapState,
    selectBackgroundLayer,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    getLayerById,
    getContext,
    fromStacToGeojsonLayer,
  }
})
