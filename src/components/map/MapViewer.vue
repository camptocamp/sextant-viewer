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
  type MapExtentChangeEvent,
  type Extent,
} from '@geospatial-sdk/core'
import { applyContextDiffToMap, createMapFromContext, listen } from '@geospatial-sdk/openlayers'
import type Map from 'ol/Map'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
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
const mapRef = shallowRef<Map | null>(null)
const lastClickCoordinate = ref<[number, number] | null>(null)

provide('map', mapRef)

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

const debouncedSetExtent = useDebounceFn((extent: Extent) => {
  mapStore.setCurrentViewExtent(extent)
}, 300)

onMounted(async () => {
  if (!mapContainer.value) return
  const initialContext = sdkContext.value
  const map = await createMapFromContext(initialContext, mapContainer.value)
  mapRef.value = map
  // Set lastAppliedContext to unblock the watch, then immediately apply any changes
  // that may have accumulated while createMapFromContext was awaited
  lastAppliedContext.value = initialContext
  const currentContext = sdkContext.value
  if (currentContext !== initialContext) {
    const diff = computeMapContextDiff(currentContext, initialContext)
    lastAppliedContext.value = currentContext
    await applyContextDiffToMap(map, diff)
  }

  // Set view padding to account for overlay panels (LayerPanel on left)
  map.getView().padding = MAP_VIEW_PADDING

  emit('map-ready', map)

  listen(map, 'map-extent-change', (event: MapExtentChangeEvent) => {
    debouncedSetExtent(event.extent as Extent)
  })
  listen(map, 'map-click', handleMapClick)
  listen(map, 'features-click', handleFeaturesClick)
})

// Watch's own oldContext is captured at setup (pre-map) and goes stale across
// the await in onMounted, so onMounted seeds the real applied baseline here and
// the watch advances it. applyChain serializes async applies so rapid context
// changes can't interleave on the same map.
const lastAppliedContext = shallowRef<MapContext | null>(null)
let applyChain = Promise.resolve()

watch(fullMapContext, (newContext) => {
  if (!mapRef.value || !lastAppliedContext.value) return
  const previousContext = lastAppliedContext.value
  lastAppliedContext.value = newContext
  applyChain = applyChain.then(() => {
    const map = mapRef.value
    if (!map) return
    const diff = computeMapContextDiff(newContext, previousContext)
    return applyContextDiffToMap(map, diff).then(() => {})
  })
})

onBeforeUnmount(() => {
  featureSelectionStore.clearSelection()

  if (mapRef.value) {
    mapRef.value.setTarget(undefined)
    mapRef.value.dispose()
    mapRef.value = null
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
