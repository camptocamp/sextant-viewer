import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Feature } from 'geojson'

export const useFeatureSelectionStore = defineStore('featureSelection', () => {
  const selectedFeature = shallowRef<Feature | null>(null)
  const selectedLayerIndex = ref<number | null>(null)
  const popupCoordinate = ref<[number, number] | null>(null)

  const isPopupOpen = computed(() => selectedFeature.value !== null)

  function selectFeature(feature: Feature, layerIndex: number, coordinate: [number, number]) {
    selectedFeature.value = feature
    selectedLayerIndex.value = layerIndex
    popupCoordinate.value = coordinate
  }

  function clearSelection() {
    selectedFeature.value = null
    selectedLayerIndex.value = null
    popupCoordinate.value = null
  }

  return {
    selectedFeature,
    selectedLayerIndex,
    popupCoordinate,
    isPopupOpen,
    selectFeature,
    clearSelection,
  }
})
