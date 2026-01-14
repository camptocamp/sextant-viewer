import { computed, reactive, ref, type Ref } from 'vue'
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
import type { MapLayerStac } from '@/types/stac-layer.types'
import { StacEndpoint } from '@camptocamp/ogc-client'
import { buildStacRequestParams } from '@/types/stac-api.types'
import { computedAsync } from '@vueuse/core'

// Extended context type that allows our custom MapLayer union (includes STAC)
export interface ExtendedMapContext extends Omit<MapContext, 'layers'> {
  view: MapContextView
  layers: MapLayer[]
}

export const useMapStore = defineStore('map', () => {
  // Simple context that allows STAC layers
  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>({
    view: DEFAULT_MAP_CONTEXT.view || {
      center: [0, 0] as [number, number],
      zoom: 2,
    },
    layers: DEFAULT_MAP_CONTEXT.layers || [],
  })

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

  function setContext(newContext: MapContext) {
    context.value = newContext
  }

  /**
   * SDK-compatible context that maps STAC layers to GeoJSON with URLs.
   * The geospatial-sdk will handle fetching the data.
   */
  const sdkContext = computedAsync<MapContext>(async () => ({
    view: context.value.view,
    layers: await Promise.all(
      context.value.layers.map(async (layer) => {
        if (isStacLayer(layer)) {
          initStacLayer(layer)
          return await mapStacToGeojsonUrl(layer)
        }
        return layer as MapContextLayer
      }),
    ),
  }))

  function initStacLayer(layer: MapLayerStac) {
    if (!layer.filters) {
      layer.filters = {
        dateRange: { start: null, end: null },
        spatialExtent: { enabled: false, bbox: null },
      }
    }
    if (!layer.pagination) {
      layer.pagination = {
        currentPage: 1,
        totalItems: 0,
        itemsPerPage: 10,
        nextLink: null,
        prevLink: null,
      }
    }
  }
  /**
   * Map STAC layer to GeoJSON layer with URL for geospatial-sdk to fetch.
   */
  async function mapStacToGeojsonUrl(layer: MapLayerStac): Promise<MapContextLayer> {
    try {
      const endpoint = new StacEndpoint(layer.url)
      const params = buildStacRequestParams(layer.filters, layer.pagination?.itemsPerPage)

      let itemsUrl
      if (layer.collectionId) {
        itemsUrl = await endpoint.getCollectionItemsUrl(layer.collectionId, params)
      } else
        itemsUrl = await (
          await StacEndpoint.fromUrl(layer.url, params)
        ).data.links.find((link) => link.rel === 'items')?.href

      return reactive({
        type: 'geojson',
        id: layer.id,
        label: layer.label,
        opacity: 1,
        version: layer.version,
        url: itemsUrl,
      }) as MapContextLayer
    } catch (error) {
      console.error('Error generating STAC items URL:', error)
      // Return empty geojson layer on error
      return reactive({
        type: 'geojson',
        id: layer.id,
        label: layer.label,
        opacity: 1,
        version: layer.version,
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      }) as MapContextLayer
    }
  }

  function setView(newView: MapContextView) {
    context.value = {
      ...context.value,
      view: newView,
    }
  }

  function addLayer(layer: MapContextLayer) {
    const versionedLayer = { ...layer, version: 0 } // we're tracking changes on layers by version
    context.value = addLayerToContext(
      context.value as MapContext,
      versionedLayer,
    ) as ExtendedMapContext
  }

  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value as MapContext, layer) as ExtendedMapContext
  }

  function changeLayerPosition(layer: MapContextLayer, delta: number) {
    const oldPosition = getLayerPosition(context.value as MapContext, layer)
    const newPosition = oldPosition + delta
    context.value = changeLayerPositionInContext(
      context.value as MapContext,
      layer,
      newPosition,
    ) as ExtendedMapContext
  }

  function updateLayer(layer: MapContextLayer, updates: Partial<MapContextLayer>) {
    context.value = updateLayerInContext(context.value, layer, updates)
  }

  return {
    context,
    sdkContext,
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
