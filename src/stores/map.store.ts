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
import {
  applyWmsFilter,
  isLayerDataIndexed,
  isStacLayer,
  stripAttributeFilterExtras,
} from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import { enrichStacLayer } from '@/utils/stac.utils'
import { enrichWmsDimensionsLayer, stripDerivedExtras } from '@/utils/wms.utils'
import { resolveAttributeFilter } from '@/utils/geonetwork-index'
import { enrichNcwmsLayer } from '@/utils/ncwms.utils'
import { v4 as uuidv4 } from 'uuid'
import type { ExtendedMapContext } from '@/types/map.types'
import type { WpsService } from '@/types/wps.types'

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
  const wpsServices = computed<WpsService[]>(() => context.value.wpsServices ?? [])

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
          const l = layer as MapContextLayer
          if (l.type === 'wms') {
            return applyWmsFilter(l.useTiles === undefined ? { ...l, useTiles: false } : l)
          }
          return l
        }),
    ],
  }))

  async function enrichLayer(layer: MapLayer): Promise<MapLayer> {
    let enriched: MapLayer = {
      ...layer,
      id: layer.id || uuidv4(),
      version: layer.version ?? 0,
    }

    if (isStacLayer(enriched)) {
      return (await enrichStacLayer(enriched)) ?? enriched
    }

    enriched = await enrichNcwmsLayer(enriched)
    return enrichWmsDimensionsLayer(enriched)
  }

  async function enrichContext(context: ExtendedMapContext): Promise<ExtendedMapContext> {
    return {
      ...context,
      layers: await Promise.all((context.layers ?? []).map(enrichLayer)),
      backgroundLayers: await Promise.all((context.backgroundLayers ?? []).map(enrichLayer)),
    }
  }

  /**
   * Fire-and-forget attribute-filter detection: the GeoNetwork/ES probes only feed the optional
   * "Filtre" tab, so they must never delay the layer's rendering. When the index resolves, the
   * layer is patched in place — without a version bump, since the layer handed to the SDK is
   * unchanged (applyWmsFilter strips `dataIndex`).
   */
  function detectDataIndex(layer: MapLayer) {
    if (layer.type !== 'wms' || isLayerDataIndexed(layer)) return
    resolveAttributeFilter(layer, context.value.dataSources ?? []).then((dataIndex) => {
      const current = layer.id === undefined ? undefined : getLayerById(layer.id)
      if (dataIndex && current) updateLayer(current, { extras: { ...current.extras, dataIndex } })
    })
  }

  async function setInitialContext(newContext: ExtendedMapContext, apply: boolean = false) {
    initialContext.value = newContext
    if (apply) {
      setContext(initialContext.value)
    }
  }

  // Enrichment awaits remote services (STAC, capabilities, index detection); a slower older
  // setContext must not clobber a newer one when they overlap (e.g. session restore racing the
  // consumer's initial context).
  let contextRequestId = 0

  async function setContext(newContext: ExtendedMapContext) {
    const requestId = ++contextRequestId
    const enriched = await enrichContext(newContext)
    if (requestId !== contextRequestId) return
    context.value = {
      ...enriched,
      view: { ...newContext.view }, // Force view application if same as current value
    }
    context.value.layers.forEach(detectDataIndex)
  }

  function setWpsServices(services: WpsService[]) {
    context.value = { ...context.value, wpsServices: services }
  }

  function addWpsService(service: WpsService) {
    if (wpsServices.value.some((s) => s.url === service.url)) return
    context.value = { ...context.value, wpsServices: [...wpsServices.value, service] }
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

    detectDataIndex(enrichedLayer)
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
    toClean.map(({ id: _id, version: _version, ...rest }) =>
      stripAttributeFilterExtras(stripDerivedExtras(rest)),
    )

  function getContext(): ExtendedMapContext {
    return {
      ...context.value,
      layers: cleanLayers(layers.value),
      backgroundLayers: cleanLayers(backgroundLayers.value),
      // The current extent once the map reported one (extent only: a stale `geometry` would win
      // over it on re-application), the declared view before that.
      view: currentExtent.value ? { extent: currentExtent.value } : context.value.view,
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
    wpsServices,
    setInitialContext,
    setContext,
    setWpsServices,
    addWpsService,
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
