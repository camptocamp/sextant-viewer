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
    autoPan: {
      animation: { duration: FEATURE_POPUP.AUTO_PAN_DURATION },
      margin: FEATURE_POPUP.BASE_MARGIN,
    },
    positioning: 'bottom-center',
    offset: [0, FEATURE_POPUP.VERTICAL_OFFSET],
    stopEvent: true,
  })
  map.addOverlay(overlay.value)
}

async function updateOverlayPosition() {
  if (!overlay.value) return

  const coordinate = featureSelectionStore.popupCoordinate
  if (coordinate) {
    await nextTick()
    overlay.value.setPosition(fromLonLat(coordinate))
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
