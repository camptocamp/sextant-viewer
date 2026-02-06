# Data Model: Map Feature Click Popup

**Feature**: 002-map-feature-click-popup
**Date**: 2026-01-26

## Entities

### SelectedFeatureState

Central state for feature selection and hover tracking.

```typescript
interface SelectedFeatureState {
  /** Currently selected feature (null if none) */
  selectedFeature: Feature | null
  
  /** Layer containing the selected feature */
  selectedLayer: BaseLayer | null
  
  /** Feature currently under cursor (for hover highlight) */
  hoveredFeature: Feature | null
  
  /** Map coordinates for popup positioning */
  popupCoordinate: Coordinate | null
  
  /** Whether popup is currently visible */
  isPopupOpen: boolean
}
```

### FeatureInfo

Processed feature information for display in popup.

```typescript
interface FeatureInfo {
  /** Display name of the containing layer */
  layerName: string
  
  /** Feature identifier or "Objet sans identifiant" */
  featureId: string
  
  /** Processed attributes for display */
  attributes: FeatureAttribute[]
}

interface FeatureAttribute {
  /** Attribute name */
  name: string
  
  /** Raw attribute value */
  value: unknown
  
  /** Display-formatted value */
  displayValue: string
  
  /** Extracted HTTP/HTTPS URLs from value (if any) */
  urls: string[]
}
```

### HighlightStyle

Style configuration for hover and selection highlights.

```typescript
interface HighlightStyle {
  /** Style for hovered features */
  hover: StyleLike
  
  /** Style for selected features */
  selected: StyleLike
}
```

## State Transitions

```
Initial State
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  No Selection                                           │
│  selectedFeature: null, hoveredFeature: null            │
│  isPopupOpen: false                                     │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────────┐  ┌─────────────────────────────────────────┐
│ Hover       │  │ Click on Feature                        │
│ Feature     │  │                                         │
│             │  │ selectedFeature: Feature                │
│ hoveredFea- │  │ popupCoordinate: click coords           │
│ ture: Feat- │  │ isPopupOpen: true                       │
│ ure         │  └────────────────┬────────────────────────┘
│             │                   │
│ cursor:     │      ┌────────────┼────────────┐
│ pointer     │      │            │            │
└──────┬──────┘      ▼            ▼            ▼
       │        Close Button  Click Outside  Escape Key
       │             │            │            │
       │             └────────────┴────────────┘
       │                          │
       ▼                          ▼
   Mouse Out              ┌───────────────────┐
       │                  │ Deselect          │
       ▼                  │ selectedFeature:  │
┌─────────────┐           │ null              │
│ No Hover    │           │ isPopupOpen:      │
│ hoveredFea- │           │ false             │
│ ture: null  │           └───────────────────┘
│ cursor:     │
│ default     │
└─────────────┘
```

## Validation Rules

### Feature Selection
- Only vector layer features can be selected
- Raster layers and layers without client-side data are excluded
- Topmost feature is selected when multiple overlap

### Popup Display
- Popup appears only when `selectedFeature !== null`
- Popup position updates with map pan/zoom via OpenLayers Overlay
- Autopan ensures popup visibility within viewport

### Attribute Processing
- Null/undefined values display as "-" or empty string
- URL detection applies only to string values
- Only HTTP/HTTPS protocols are linkified

## Relationships

```
┌──────────────────┐     contains      ┌──────────────────┐
│  SelectedFeature │◄─────────────────►│  SelectedLayer   │
│  State           │                   │  (BaseLayer)     │
└────────┬─────────┘                   └──────────────────┘
         │
         │ extracts
         ▼
┌──────────────────┐     has many      ┌──────────────────┐
│  FeatureInfo     │───────────────────►│ FeatureAttribute │
└──────────────────┘                   └──────────────────┘
         │                                      │
         │ positions                            │ may contain
         ▼                                      ▼
┌──────────────────┐                   ┌──────────────────┐
│  Popup           │                   │  URLs            │
│  (OpenLayers     │                   │  (clickable      │
│   Overlay)       │                   │   links)         │
└──────────────────┘                   └──────────────────┘
```

## Pinia Store Structure

```typescript
// src/stores/featureSelection.store.ts
export const useFeatureSelectionStore = defineStore('featureSelection', () => {
  // State
  const selectedFeature = ref<Feature | null>(null)
  const selectedLayer = ref<BaseLayer | null>(null)
  const hoveredFeature = ref<Feature | null>(null)
  const popupCoordinate = ref<Coordinate | null>(null)
  
  // Computed
  const isPopupOpen = computed(() => selectedFeature.value !== null)
  const featureInfo = computed<FeatureInfo | null>(() => {
    if (!selectedFeature.value || !selectedLayer.value) return null
    return extractFeatureInfo(selectedFeature.value, selectedLayer.value)
  })
  
  // Actions
  function selectFeature(feature: Feature, layer: BaseLayer, coordinate: Coordinate) {...}
  function clearSelection() {...}
  function setHoveredFeature(feature: Feature | null) {...}
  
  return {
    selectedFeature,
    selectedLayer,
    hoveredFeature,
    popupCoordinate,
    isPopupOpen,
    featureInfo,
    selectFeature,
    clearSelection,
    setHoveredFeature,
  }
})
```

## OpenLayers Types Used

```typescript
import type { Feature } from 'ol'
import type { Coordinate } from 'ol/coordinate'
import type BaseLayer from 'ol/layer/Base'
import type VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import type { StyleLike } from 'ol/style/Style'
import Overlay from 'ol/Overlay'
import Select from 'ol/interaction/Select'
```
