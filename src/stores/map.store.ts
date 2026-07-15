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
import type { DataSource } from '@/types/data-source.types'
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
          const l = layer as MapContextLayer
          if (l.type === 'wms') {
            return applyWmsFilter(l.useTiles === undefined ? { ...l, useTiles: false } : l)
          }
          return l
        }),
    ],
  }))

  function seedLayer(layer: MapLayer): MapLayer {
    return {
      ...layer,
      id: layer.id || uuidv4(),
      version: layer.version ?? 0,
    }
  }

  async function enrichLayerData(layer: MapLayer): Promise<MapLayer> {
    if (isStacLayer(layer)) {
      const enriched = await enrichStacLayer(layer as MapLayerStac)
      return enriched ?? layer
    }

    return enrichWmsDimensionsLayer(layer)
  }

  async function enrichLayer(layer: MapLayer): Promise<MapLayer> {
    return enrichLayerData(seedLayer(layer))
  }

  // Bumped by setContext so pending enrichment patches from a superseded context are dropped
  // instead of overwriting the newer one.
  let contextGeneration = 0

  // Server-derived enrichment (WMS dimensions, STAC data) lands after the context is applied,
  // so a slow or hung server never blocks the initial render.
  async function patchLayerWhenEnriched(layer: MapLayer, generation: number) {
    try {
      const enriched = await enrichLayerData(layer)
      if (enriched === layer || generation !== contextGeneration) return

      const { id: _id, version: _version, ...updates } = enriched
      updateLayer(layer, updates as Partial<MapLayer>)
    } catch (error) {
      console.error('Layer enrichment failed', layer.id, error)
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

  function setInitialContext(newContext: ExtendedMapContext, apply: boolean = false) {
    initialContext.value = newContext
    if (apply) {
      setContext(initialContext.value)
    }
  }

  function setContext(newContext: ExtendedMapContext) {
    const generation = ++contextGeneration
    const applied: ExtendedMapContext = {
      ...newContext,
      layers: (newContext.layers ?? []).map(seedLayer),
      backgroundLayers: (newContext.backgroundLayers ?? []).map(seedLayer),
      view: { ...newContext.view }, // Force view application if same as current value
    }

    context.value = applied

    for (const layer of [...applied.layers, ...(applied.backgroundLayers ?? [])]) {
      void patchLayerWhenEnriched(layer, generation)
    }

    applied.layers.forEach(detectDataIndex)
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
      stripAttributeFilterExtras(stripDerivedExtras(rest as MapLayer)),
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

  function addDataSource(dataSource: DataSource) {
    const existing = context.value.dataSources ?? []
    // Idempotent: the persisted context restores sources, and consumers re-register on each load.
    if (!existing.some((ds) => ds.url === dataSource.url && ds.type === dataSource.type)) {
      context.value = { ...context.value, dataSources: [...existing, dataSource] }
    }
    // A source registered after layers were added must still resolve their indexes.
    layers.value.forEach(detectDataIndex)
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
    addDataSource,
    addLayer,
    deleteLayer,
    changeLayerPosition,
    updateLayer,
    getLayerById,
    getContext,
    fromStacToGeojsonLayer,
  }
})
