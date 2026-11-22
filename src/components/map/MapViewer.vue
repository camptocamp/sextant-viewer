<script setup lang="ts">
import { MAP_VIEW_PADDING } from '@/constants/layout'
import { useFeatureSelectionStore } from '@/stores/featureSelection.store'
import { useMapStore } from '@/stores/map.store'
import { FEATURE_SELECTED_STYLE } from '@/utils/feature-styles'
import {
  computeMapContextDiff,
  type FeaturesClickEvent,
  type MapClickEvent,
  type MapContext,
  type MapStateChangeEvent,
  type ResolvedMapState,
} from '@geospatial-sdk/core'
import { applyContextDiffToMap, createMapFromContext, listen } from '@geospatial-sdk/openlayers'
import type Map from 'ol/Map'
import { storeToRefs } from 'pinia'
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FeaturePopup from './FeaturePopup.vue'
import MapLoadingIndicator from './MapLoadingIndicator.vue'
import ResetExtentButton from './ResetExtentButton.vue'
import BackgroundLayerSelector from './BackgroundLayerSelector.vue'
import { useDebounceFn } from '@vueuse/core'

const mapStore = useMapStore()
const featureSelectionStore = useFeatureSelectionStore()
const { sdkContext } = storeToRefs(mapStore)
const { selectedFeature } = storeToRefs(featureSelectionStore)

const mapContainer = ref<HTMLElement | undefined>()
const lastClickCoordinate = ref<[number, number] | null>(null)

const emit = defineEmits<{
  'map-ready': [map: Map]
}>()

function handleMapClick(event: MapClickEvent) {
  lastClickCoordinate.value = event.coordinate
}

function handleFeaturesClick(event: FeaturesClickEvent) {
  const { featuresByLayer } = event

  if (featuresByLayer.size === 0) {
    featureSelectionStore.clearSelection()
    return
  }

  const firstEntry = featuresByLayer.entries().next().value
  if (!firstEntry) {
    featureSelectionStore.clearSelection()
    return
  }

  const [layerIndex, features] = firstEntry
  const firstFeature = features[0]
  const layerId = mapStore.sdkContext.layers[layerIndex]?.id?.toString()

  if (firstFeature && lastClickCoordinate.value && layerId) {
    featureSelectionStore.selectFeature(firstFeature, layerId, lastClickCoordinate.value)
  }
}

const fullMapContext = computed<MapContext>(() => {
  const context = sdkContext.value
  if (selectedFeature.value === null) return context
  return {
    ...context,
    layers: [
      ...context.layers,
      {
        type: 'geojson',
        enableHover: false,
        disableClick: true,
        id: 'selected-objects',
        data: { type: 'FeatureCollection', features: [selectedFeature.value] },
        style: FEATURE_SELECTED_STYLE,
      },
    ],
  }
})

const debouncedSetMapState = useDebounceFn((mapState: ResolvedMapState) => {
  mapStore.setMapState(mapState)
}, 300)

onMounted(() => {
  if (!mapContainer.value) return
  // createMapFromContext is synchronous and applyContextDiffToMap serializes its
  // own updates internally, so the watcher just diffs and applies.
  const map = createMapFromContext(fullMapContext.value, mapContainer.value)
  // Kept out of reactivity: Vue and the devtools must not walk the OpenLayers object graph.
  mapStore.olMap = markRaw(map)

  // Set view padding to account for overlay panels (LayerPanel on left)
  map.getView().padding = MAP_VIEW_PADDING

  emit('map-ready', map)

  listen(map, 'map-state-change', (event: MapStateChangeEvent) => {
    debouncedSetMapState(event.mapState)
  })
  listen(map, 'map-click', handleMapClick)
  listen(map, 'features-click', handleFeaturesClick)
})

watch(fullMapContext, (newContext, oldContext) => {
  if (!mapStore.olMap) return
  const diff = computeMapContextDiff(newContext, oldContext)
  applyContextDiffToMap(mapStore.olMap, diff)
})

onBeforeUnmount(() => {
  featureSelectionStore.clearSelection()

  if (mapStore.olMap) {
    mapStore.olMap.setTarget(undefined)
    mapStore.olMap.dispose()
    mapStore.olMap = null
  }
})
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="mapContainer" class="absolute inset-0"></div>
    <MapLoadingIndicator />
    <FeaturePopup />
    <div class="absolute top-15 right-[.5em] flex flex-col gap-1">
      <ResetExtentButton />
      <BackgroundLayerSelector />
    </div>
  </div>
</template>

<style scoped></style>
