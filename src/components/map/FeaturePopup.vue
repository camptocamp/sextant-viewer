<script setup lang="ts">
import { useFeatureInfo } from '@/composables/useFeatureInfo'
import { FEATURE_POPUP } from '@/constants/layout'
import { useFeatureSelectionStore } from '@/stores/featureSelection.store'
import { useMapStore } from '@/stores/map.store'
import { getLayerLabel } from '@/utils/layer.utils'
import type Map from 'ol/Map'
import Overlay from 'ol/Overlay'
import { fromLonLat } from 'ol/proj'
import type { ShallowRef } from 'vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import FeaturePopupContent from './FeaturePopupContent.vue'

const mapRef = inject<ShallowRef<Map | null>>('map')
const featureSelectionStore = useFeatureSelectionStore()
const mapStore = useMapStore()
const { extractFeatureInfo } = useFeatureInfo()

const popupContainer = ref<HTMLElement>()
const overlay = shallowRef<Overlay>()

const layerName = computed(() => {
  const layerId = featureSelectionStore.selectedLayerId
  if (!layerId) return 'Couche inconnue'
  const layer = mapStore.layers.find((l) => l.id === layerId)
  return layer ? getLayerLabel(layer) : 'Couche inconnue'
})

const featureInfo = computed(() => {
  if (!featureSelectionStore.selectedFeature) return null
  return extractFeatureInfo(featureSelectionStore.selectedFeature, layerName.value)
})

const isPopupVisible = computed(() => featureSelectionStore.popupCoordinate !== null)

function initOverlay(map: Map) {
  if (!popupContainer.value) return

  overlay.value = new Overlay({
    element: popupContainer.value,
    // Disable built-in autoPan - we handle it manually with view padding support
    autoPan: false,
    positioning: 'bottom-center',
    offset: [0, FEATURE_POPUP.VERTICAL_OFFSET],
    stopEvent: true,
  })

  map.addOverlay(overlay.value)
}

/**
 * Custom autoPan that respects the view padding
 * Uses the actual popup element's bounding box to determine visibility
 */
function autoPanWithPadding(map: Map) {
  if (!popupContainer.value) return

  const view = map.getView()
  const viewPadding = view.padding ?? [0, 0, 0, 0]
  const paddingTop = viewPadding[0] ?? 0
  const paddingRight = viewPadding[1] ?? 0
  const paddingBottom = viewPadding[2] ?? 0
  const paddingLeft = viewPadding[3] ?? 0

  // Get the map container's bounding rect
  const mapElement = map.getTargetElement()
  if (!mapElement) return
  const mapRect = mapElement.getBoundingClientRect()

  // Get the popup's bounding rect
  const popupRect = popupContainer.value.getBoundingClientRect()
  if (popupRect.width === 0 || popupRect.height === 0) return

  // Calculate the visible area within the map (accounting for padding)
  const margin = FEATURE_POPUP.BASE_MARGIN
  const visibleLeft = mapRect.left + paddingLeft + margin
  const visibleTop = mapRect.top + paddingTop + margin
  const visibleRight = mapRect.right - paddingRight - margin
  const visibleBottom = mapRect.bottom - paddingBottom - margin

  // Calculate how much we need to pan (in screen pixels)
  let deltaX = 0
  let deltaY = 0

  // Check if popup extends beyond visible area
  if (popupRect.left < visibleLeft) {
    deltaX = popupRect.left - visibleLeft
  } else if (popupRect.right > visibleRight) {
    deltaX = popupRect.right - visibleRight
  }

  if (popupRect.top < visibleTop) {
    deltaY = popupRect.top - visibleTop
  } else if (popupRect.bottom > visibleBottom) {
    deltaY = popupRect.bottom - visibleBottom
  }

  // If panning is needed, animate the view
  if (deltaX !== 0 || deltaY !== 0) {
    const center = view.getCenter()
    if (!center || center[0] === undefined || center[1] === undefined) return

    const resolution = view.getResolution()
    if (!resolution) return

    const newCenter: [number, number] = [
      center[0] + deltaX * resolution,
      center[1] - deltaY * resolution,
    ]

    view.animate({
      center: newCenter,
      duration: FEATURE_POPUP.AUTO_PAN_DURATION,
    })
  }
}

function updateOverlayPosition() {
  if (!overlay.value) return

  const coordinate = featureSelectionStore.popupCoordinate
  if (coordinate) {
    const mapCoordinate = fromLonLat(coordinate)
    overlay.value.setPosition(mapCoordinate)

    // Apply custom autoPan after the overlay is positioned and rendered
    const map = mapRef?.value
    if (map) {
      nextTick(() => {
        autoPanWithPadding(map)
      })
    }
  } else {
    overlay.value.setPosition(undefined)
  }
}

watch(
  () => featureSelectionStore.popupCoordinate,
  () => updateOverlayPosition(),
)

watch(
  () => mapRef?.value,
  (map) => {
    if (map && !overlay.value) {
      initOverlay(map)
      updateOverlayPosition()
    }
  },
  { immediate: true },
)

onMounted(() => {
  const map = mapRef?.value
  if (map) {
    initOverlay(map)
    updateOverlayPosition()
  }
})

function handleClose() {
  featureSelectionStore.clearSelection()
}

onBeforeUnmount(() => {
  const map = mapRef?.value
  if (map && overlay.value) {
    map.removeOverlay(overlay.value)
  }
})
</script>

<template>
  <div ref="popupContainer" class="ol-popup">
    <UCard
      v-if="isPopupVisible && featureInfo"
      :ui="{
        root: 'shadow-lg',
        body: 'p-3',
      }"
    >
      <FeaturePopupContent
        :layer-name="featureInfo.layerName"
        :feature-id="featureInfo.featureId"
        :attributes="featureInfo.attributes"
        @close="handleClose"
      />
    </UCard>
  </div>
</template>

<style scoped>
.ol-popup {
  position: absolute;
  transform: translate(-50%, -100%);
}
</style>
