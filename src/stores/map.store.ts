import { computed, ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addLayerToContext,
  changeLayerPositionInContext,
  getLayerPosition,
  type MapContext,
  type MapContextLayer,
  type MapContextLayerWms,
  type MapContextView,
  removeLayerFromContext,
  updateLayerInContext,
  type Extent,
} from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'
import type { MapLayer } from '@/utils/layer.utils'
import { getDefaultWmsTime, isStacLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import { enrichStacLayer } from '@/utils/stac.utils'
import { v4 as uuidv4 } from 'uuid'
import { WmsEndpoint } from '@camptocamp/ogc-client'
import type { ExtendedMapContext } from '@/types/map.types'

export type { ExtendedMapContext }

const FALLBACK_VIEW: MapContextView = {
  center: [0, 0] as [number, number],
  zoom: 2,
}

export const useMapStore = defineStore('map', () => {
  const initialContext = ref<ExtendedMapContext>(DEFAULT_MAP_CONTEXT)

  const context: Ref<ExtendedMapContext> = ref<ExtendedMapContext>(initialContext.value)
  const currentExtent = ref<Extent | null>(null)

  const backgroundLayers = computed<MapLayer[]>(
    () => context.value.backgroundLayers ?? DEFAULT_MAP_CONTEXT.backgroundLayers,
  )
  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

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
      id: layer.id ? layer.id : uuidv4(),
      version: layer.version !== undefined ? layer.version : 0,
    }

    if (isStacLayer(layer)) {
      const enriched = await enrichStacLayer(layerWithVersionAndId as MapLayerStac)
      return enriched ?? layerWithVersionAndId
    }

    if (layer.type === 'wms' && !layer.extras?.wmsTimeDimension) {
      try {
        const endpoint = new WmsEndpoint((layer as { url: string }).url)
        await endpoint.isReady()
        const layerInfo = endpoint.getLayerByName((layer as { name: string }).name)
        // WMS dimension names are case-insensitive; servers may emit TIME, Time, etc.
        const timeDim = layerInfo?.dimensions?.find((d) => d.name.toLowerCase() === 'time')
        if (timeDim) {
          const wmsLayer = layerWithVersionAndId as MapContextLayerWms
          // Seed TIME so the selector reflects what the server renders by default
          // (a GetMap without TIME falls back to the server's declared default).
          // Mirror reset()'s target, but never overwrite a consumer-provided value.
          const seedTime = wmsLayer.dimensionValues?.TIME ?? getDefaultWmsTime(timeDim)
          return {
            ...layerWithVersionAndId,
            extras: { ...layerWithVersionAndId.extras, wmsTimeDimension: timeDim },
            ...(seedTime && {
              dimensionValues: { ...wmsLayer.dimensionValues, TIME: seedTime },
            }),
          }
        }
      } catch (err) {
        // enrichment failure is non-fatal; proceed without dimension info
        console.error('WMS time dimension enrichment failed', err)
      }
    }

    return layerWithVersionAndId
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

  function setCurrentViewExtent(extent: Extent) {
    currentExtent.value = extent
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
    view,
    currentExtent,
    backgroundLayers,
    setInitialContext,
    setContext,
    setView,
    resetView,
    setCurrentViewExtent,
    selectBackgroundLayer,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    getLayerById,
    fromStacToGeojsonLayer,
  }
})
