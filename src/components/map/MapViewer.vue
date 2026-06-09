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
  mapRef.value = await createMapFromContext(sdkContext.value, mapContainer.value)

  // Set view padding to account for overlay panels (LayerPanel on left)
  mapRef.value.getView().padding = MAP_VIEW_PADDING

  emit('map-ready', mapRef.value)

  listen(mapRef.value, 'map-extent-change', (event: MapExtentChangeEvent) => {
    debouncedSetExtent(event.extent as Extent)
  })
  listen(mapRef.value, 'map-click', handleMapClick)
  listen(mapRef.value, 'features-click', handleFeaturesClick)
})

watch(fullMapContext, (newContext, oldContext) => {
  if (!mapRef.value) return
  const diff = computeMapContextDiff(newContext, oldContext)
  applyContextDiffToMap(mapRef.value, diff)
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
