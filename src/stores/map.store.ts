import { computed, ref, watchEffect, type Ref } from 'vue'
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
import type { Extent } from 'ol/extent'
import { useDebounceFn } from '@vueuse/core'

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

  const sessionContext = ref<ExtendedMapContext | null>(
    JSON.parse(sessionStorage.getItem('mapContext') || 'null'),
  )

  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>(
    sessionContext.value || {
      view: initialContext.value.view || FALLBACK_VIEW,
      layers: initialContext.value.layers || [],
    },
  )

  const currentExtent = ref<Extent | undefined>(undefined)

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

  const saveContextToStorage = useDebounceFn(
    (ctx: ExtendedMapContext, extent: Extent | undefined) => {
      if (ctx === initialContext.value) return
      if (extent) {
        ctx.view = {
          extent: extent as [number, number, number, number], // cast currently needed to satisfy geospatial-sdk's type
        }
      }
      sessionContext.value = ctx
      sessionStorage.setItem('mapContext', JSON.stringify(ctx))
    },
    500,
  )

  watchEffect(() => {
    saveContextToStorage(context.value, currentExtent.value)
  })

  function setContext(newContext: ExtendedMapContext) {
    context.value = newContext
  }

  function resetContext() {
    sessionContext.value = null
    sessionStorage.removeItem('mapContext')
    context.value = initialContext.value
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
    initialContext,
    sessionContext,
    layers,
    view,
    currentExtent,
    setContext,
    resetContext,
    setView,
    resetView,
    setCurrentViewExtent,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    fromStacToGeojsonLayer,
  }
})
