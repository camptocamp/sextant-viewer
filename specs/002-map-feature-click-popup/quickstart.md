# Quickstart: Map Feature Click Popup

**Feature**: 002-map-feature-click-popup
**Date**: 2026-01-26

## Overview

This feature adds interactive feature selection to the map. Clicking on a vector feature displays a popup with layer name, feature ID, and attributes.

## Prerequisites

- OpenLayers map instance accessible in MapViewer
- Vector layers loaded (WFS, GeoJSON, OGC API)
- NuxtUI Popover component available

## Implementation Steps

### Step 1: Create Feature Selection Store

```typescript
// src/stores/featureSelection.store.ts
import { defineStore } from 'pinia'
import type { Feature } from 'ol'
import type BaseLayer from 'ol/layer/Base'
import type { Coordinate } from 'ol/coordinate'

export const useFeatureSelectionStore = defineStore('featureSelection', () => {
  const selectedFeature = ref<Feature | null>(null)
  const selectedLayer = ref<BaseLayer | null>(null)
  const popupCoordinate = ref<Coordinate | null>(null)
  const hoveredFeature = ref<Feature | null>(null)

  const isPopupOpen = computed(() => selectedFeature.value !== null)

  function selectFeature(feature: Feature, layer: BaseLayer, coordinate: Coordinate) {
    selectedFeature.value = feature
    selectedLayer.value = layer
    popupCoordinate.value = coordinate
  }

  function clearSelection() {
    selectedFeature.value = null
    selectedLayer.value = null
    popupCoordinate.value = null
  }

  function setHoveredFeature(feature: Feature | null) {
    hoveredFeature.value = feature
  }

  return {
    selectedFeature,
    selectedLayer,
    popupCoordinate,
    hoveredFeature,
    isPopupOpen,
    selectFeature,
    clearSelection,
    setHoveredFeature,
  }
})
```

### Step 2: Create Map Interaction Composable

```typescript
// src/composables/useMapFeatureInteraction.ts
import type Map from 'ol/Map'
import type { Feature } from 'ol'
import VectorLayer from 'ol/layer/Vector'

export function useMapFeatureInteraction(mapRef: Ref<Map | null>) {
  const featureSelectionStore = useFeatureSelectionStore()

  function handleClick(event: MapBrowserEvent<UIEvent>) {
    const map = mapRef.value
    if (!map) return

    const hit = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
      if (layer instanceof VectorLayer) {
        return { feature: feature as Feature, layer }
      }
    })

    if (hit) {
      featureSelectionStore.selectFeature(hit.feature, hit.layer, event.coordinate)
    } else {
      featureSelectionStore.clearSelection()
    }
  }

  function handlePointerMove(event: MapBrowserEvent<UIEvent>) {
    const map = mapRef.value
    if (!map) return

    const hasFeature = map.hasFeatureAtPixel(event.pixel, {
      layerFilter: (layer) => layer instanceof VectorLayer,
    })

    map.getTargetElement().style.cursor = hasFeature ? 'pointer' : ''
  }

  // ... activate/deactivate/cleanup
}
```

### Step 3: Create Popup Components

```vue
<!-- src/components/map/FeaturePopup.vue -->
<script setup lang="ts">
import Overlay from 'ol/Overlay'
import { useFeatureSelectionStore } from '@/stores/featureSelection.store'

const featureSelectionStore = useFeatureSelectionStore()
const popupRef = ref<HTMLElement>()
const overlay = ref<Overlay>()

// Create overlay on mount, position at popupCoordinate
</script>

<template>
  <div ref="popupRef">
    <UPopover v-if="featureSelectionStore.isPopupOpen" :open="true" arrow>
      <FeaturePopupContent
        :layer-name="featureInfo.layerName"
        :feature-id="featureInfo.featureId"
        :attributes="featureInfo.attributes"
        @close="featureSelectionStore.clearSelection()"
      />
    </UPopover>
  </div>
</template>
```

### Step 4: Integrate in MapViewer

```vue
<!-- Update src/components/map/MapViewer.vue -->
<script setup lang="ts">
// Add interaction composable
const { activate, cleanup } = useMapFeatureInteraction(mapRef)

onMounted(() => {
  // ... existing map creation
  activate()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div ref="mapContainer" class="size-full">
    <FeaturePopup />
  </div>
</template>
```

## Testing Checklist

- [ ] Click on WFS feature → popup appears with attributes
- [ ] Click on GeoJSON feature → popup appears with attributes
- [ ] Click outside features → popup closes
- [ ] Click close button → popup closes
- [ ] Hover over feature → cursor changes to pointer
- [ ] Hover over feature → feature highlights
- [ ] Feature with URL attribute → URL is clickable
- [ ] Popup near edge → map autopans
- [ ] No ID feature → shows "Objet sans identifiant"
