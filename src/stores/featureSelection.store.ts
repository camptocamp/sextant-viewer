import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Feature } from 'geojson'

export const useFeatureSelectionStore = defineStore('featureSelection', () => {
  const selectedFeature = shallowRef<Feature | null>(null)
  const selectedLayerId = ref<string | null>(null)
  const popupCoordinate = ref<[number, number] | null>(null)

  const isPopupOpen = computed(() => selectedFeature.value !== null)

  function selectFeature(feature: Feature, layerId: string, coordinate: [number, number]) {
    selectedFeature.value = feature
    selectedLayerId.value = layerId
    popupCoordinate.value = coordinate
  }

  function clearSelection() {
    selectedFeature.value = null
    selectedLayerId.value = null
    popupCoordinate.value = null
  }

  return {
    selectedFeature,
    selectedLayerId,
    popupCoordinate,
    isPopupOpen,
    selectFeature,
    clearSelection,
  }
})
