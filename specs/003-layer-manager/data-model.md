# Data Model: Layer Manager

**Feature**: Layer Manager
**Date**: 2026-01-07
**Status**: Complete

## Overview

This document defines the data structures, types, and component interfaces for the layer manager feature. The layer manager works with existing `MapContext` and `MapContextLayer` types from @geospatial-sdk/core without introducing custom layer types.

---

## Core Data Types

### MapContextLayer (Existing Type)

**Source**: `@geospatial-sdk/core`

The layer manager consumes this type without modification:

```typescript
interface MapContextLayer {
  id?: string                    // Unique layer identifier
  type: string                   // Layer type: 'xyz', 'wms', 'vector', etc.
  url?: string                   // Layer data source URL
  label?: string                 // Human-readable layer name
  visibility?: boolean           // Layer visibility state
  opacity?: number               // Layer opacity (0-1)
  attributions?: string          // Attribution text
  // ... additional properties per layer type
}
```

**Key Properties for Layer Manager**:
- `id`: Used for filtering basemap and as unique key in v-for
- `label`: Displayed in layer list (with truncation)
- Additional properties not directly used by layer manager but preserved in MapContext

---

### MapContext (Existing Type)

**Source**: `@geospatial-sdk/core`

Container for all map layers and view state:

```typescript
interface MapContext {
  layers: MapContextLayer[]      // Ordered array of layers (index 0 = bottom, last = top)
  view: MapContextView           // Current map view (center, zoom, projection)
  // ... additional properties
}
```

**Layer Ordering Convention**:
- Array index determines visual stacking order
- Index 0: Bottom layer (typically basemap)
- Last index: Top layer (most visible)
- Layer manager displays in reverse order (last first)

---

## New Type Definitions

### LayerMenuItem (Component-Local)

**Purpose**: Define structure for dropdown menu items

**Definition**:
```typescript
// src/types/layer.ts
export interface LayerMenuItem {
  label: string                  // Menu item text (e.g., "Delete layer")
  icon?: string                  // Optional Heroicon name (e.g., "i-heroicons-trash")
  click: () => void              // Action handler
  disabled?: boolean             // Disable menu item (future use)
}
```

**Usage**:
```typescript
const menuItems = computed(() => [
  [{
    label: 'Delete layer',
    icon: 'i-heroicons-trash',
    click: () => handleDeleteLayer(layer.id)
  }]
])
```

---

## Component Interface

### LayerManager.vue

**Type**: Presentational/Container Hybrid Component

**Props**: None (connects directly to Pinia store)

**Emits**: None (actions handled through store)

**Exposed Methods**: None (fully encapsulated)

**Component Interface**:
```typescript
// LayerManager.vue
<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { MapContextLayer } from '@geospatial-sdk/core'

// Store connection
const mapStore = useMapStore()

// Computed properties
const dataLayers: ComputedRef<MapContextLayer[]>  // Non-basemap layers in reverse order

// Methods
function isBasemapLayer(layer: MapContextLayer, index: number): boolean
function handleDeleteLayer(layerId: string): void
</script>

<template>
  <!-- NuxtUI components only -->
  <div v-if="dataLayers.length === 0">
    <UEmpty ... />
  </div>
  <div v-else>
    <div v-for="layer in dataLayers" :key="layer.id">
      <UTooltip>
        <span class="truncate">{{ layer.label }}</span>
      </UTooltip>
      <UDropdownMenu>
        <UButton ... />
      </UDropdownMenu>
    </div>
  </div>
</template>
```

**State Management**:
- Reads from: `mapStore.layers` (via computed)
- Writes to: `mapStore.deleteLayer(layerId)` (via action)
- No local state required (stateless component)

---

## Store Interface Extensions

### map.store.ts (Modified)

**New Action**:
```typescript
// src/stores/map.store.ts
export const useMapStore = defineStore('map', () => {
  // ... existing state ...

  /**
   * Delete a layer from the MapContext by its ID
   * @param layerId - Unique identifier of the layer to delete
   */
  function deleteLayer(layerId: string): void {
    context.value = {
      ...context.value,
      layers: context.value.layers.filter(layer => layer.id !== layerId)
    }
  }

  return {
    // ... existing exports ...
    deleteLayer  // New export
  }
})
```

**Type Safety**:
- Parameter `layerId: string` - must match layer.id
- Return type `void` - no return value
- Immutable update pattern maintained

---

## Type Guards

### isBasemapLayer

**Purpose**: Identify basemap layers for filtering

**Definition**:
```typescript
// src/types/layer.ts
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Determine if a layer is a basemap/background layer
 * @param layer - The layer to check
 * @param index - The layer's position in the layers array
 * @returns true if layer is a basemap, false otherwise
 */
export function isBasemapLayer(layer: MapContextLayer, index: number): boolean {
  // Check id prefix convention
  if (layer.id?.startsWith('basemap-')) {
    return true
  }
  // Fallback: first layer is assumed to be basemap
  return index === 0
}
```

**Usage**:
```typescript
const dataLayers = computed(() => {
  return mapStore.layers
    .filter((layer, index) => !isBasemapLayer(layer, index))
    .reverse()
})
```

---

## Data Flow

### Read Flow (Display Layers)

```
MapContext (Pinia Store)
  ↓
useMapStore().layers (reactive ref)
  ↓
Computed: filter(isBasemapLayer) → reverse()
  ↓
dataLayers computed property
  ↓
v-for template rendering
  ↓
LayerManager UI (NuxtUI components)
```

### Write Flow (Delete Layer)

```
User clicks "Delete layer" in UDropdownMenu
  ↓
handleDeleteLayer(layerId) in component
  ↓
mapStore.deleteLayer(layerId) action
  ↓
Immutable MapContext update (filter layers)
  ↓
Vue reactivity triggers computed re-evaluation
  ↓
dataLayers updated
  ↓
Component re-renders with updated list
```

---

## Data Validation

### Layer ID Validation

**Requirement**: Layers must have unique IDs for deletion to work correctly

**Defensive Strategy**:
```typescript
// In component
const handleDeleteLayer = (layerId: string | undefined) => {
  if (!layerId) {
    console.warn('Cannot delete layer without ID')
    return
  }
  mapStore.deleteLayer(layerId)
}
```

**Assumption**: Geospatial-sdk generates unique IDs for layers (validated in existing code)

### Label Fallback

**Requirement**: Handle layers without labels gracefully

**Strategy**:
```typescript
// In template
<span class="truncate">{{ layer.label || 'Untitled Layer' }}</span>
```

---

## State Invariants

### MapContext Invariants (Maintained)

1. **Immutability**: All MapContext updates create new objects (spread operator)
2. **Layer Order**: Array index determines visual stacking (preserved after deletion)
3. **Basemap Presence**: At least one layer (basemap) always exists
   - Empty state shown when `dataLayers.length === 0` (basemap excluded from list)
   - MapContext always has `layers.length >= 1` (basemap remains)

### Component Invariants

1. **Unique Keys**: `v-for` uses `layer.id` as key (must be unique)
2. **Reactive Updates**: No manual array manipulation - all updates via store
3. **No Direct MapContext Mutation**: Component never modifies `mapStore.context` directly

---

## Type Definitions File Structure

### src/types/layer.ts (New File)

```typescript
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Menu item structure for layer context menu
 */
export interface LayerMenuItem {
  label: string
  icon?: string
  click: () => void
  disabled?: boolean
}

/**
 * Type guard to identify basemap layers
 */
export function isBasemapLayer(layer: MapContextLayer, index: number): boolean {
  return layer.id?.startsWith('basemap-') || index === 0
}

/**
 * Get display label for a layer with fallback
 */
export function getLayerLabel(layer: MapContextLayer): string {
  return layer.label || 'Untitled Layer'
}
```

---

## Component Props & Events (None)

**Props**: None - Component connects directly to store

**Rationale**:
- Pinia store provides global state access
- No need for prop drilling from parent components
- Component is self-contained and reusable

**Events**: None - Actions handled through store

**Rationale**:
- Store actions encapsulate all state mutations
- No need to emit events to parent
- Simpler component interface

**Future Enhancement**: If layer manager needs to be configurable, add props:
```typescript
interface LayerManagerProps {
  showBasemap?: boolean     // Option to show/hide basemap in list
  allowDeletion?: boolean   // Option to disable deletion
  maxHeight?: string        // CSS max-height for scrolling
}

defineProps<LayerManagerProps>()
```

---

## Performance Considerations

### Computed Property Caching

- `dataLayers` computed property caches result
- Only re-evaluates when `mapStore.layers` changes
- Filter + reverse operations: O(n) where n = layer count
- Expected n: 1-50 layers (typical GIS application)

### Vue Reactivity Performance

- Pinia store uses Vue's reactivity system
- Changes to nested properties (layers array) tracked automatically
- Component re-renders only when `dataLayers` value changes

### Optimization Opportunities (Future)

If layer count exceeds 100 layers:
1. Virtual scrolling (using virtual-scroller library)
2. Pagination of layer list
3. Search/filter functionality

**Current Decision**: No optimization for MVP - standard list rendering sufficient for expected scale

---

## Error Handling

### Missing Layer ID

**Scenario**: Layer without `id` property

**Handling**:
```typescript
// Use array index as fallback key
:key="layer.id || `layer-${index}`"
```

**Note**: Deletion requires id, so button should be disabled if no id:
```typescript
:disabled="!layer.id"
```

### Delete Operation Failure

**Scenario**: Layer deletion fails (e.g., last non-basemap layer)

**Current Approach**: No explicit validation - allow deletion of all data layers

**Future Enhancement**: Add validation in store action:
```typescript
function deleteLayer(layerId: string): void {
  const nonBasemapCount = context.value.layers.filter((layer, index) =>
    !isBasemapLayer(layer, index)
  ).length

  if (nonBasemapCount <= 1) {
    console.warn('Cannot delete last data layer')
    return
  }

  // Proceed with deletion...
}
```

---

## Testing Data Scenarios

### Test Case 1: Normal Operation

**Setup**:
```typescript
const mockMapContext: MapContext = {
  layers: [
    { id: 'basemap-osm', label: 'OpenStreetMap', type: 'xyz' },
    { id: 'layer-1', label: 'Population Density', type: 'wms' },
    { id: 'layer-2', label: 'Land Use', type: 'vector' },
  ],
  view: { center: [0, 0], zoom: 2 }
}
```

**Expected Behavior**:
- Display 2 layers (layer-2 first, layer-1 second)
- Basemap not shown
- Each layer has functional delete button

### Test Case 2: Empty State

**Setup**:
```typescript
const mockMapContext: MapContext = {
  layers: [
    { id: 'basemap-osm', label: 'OpenStreetMap', type: 'xyz' },
  ],
  view: { center: [0, 0], zoom: 2 }
}
```

**Expected Behavior**:
- Show UEmpty component with "No layers added" message
- No layer list rendered

### Test Case 3: Long Labels

**Setup**:
```typescript
const mockLayer = {
  id: 'layer-long',
  label: 'This is a very long layer name that should be truncated with an ellipsis to prevent layout issues',
  type: 'wms'
}
```

**Expected Behavior**:
- Label truncated with ellipsis
- Full label visible on tooltip hover
- Layout remains stable

### Test Case 4: Missing Labels

**Setup**:
```typescript
const mockLayer = {
  id: 'layer-no-label',
  type: 'wms'
  // No label property
}
```

**Expected Behavior**:
- Display "Untitled Layer" as fallback
- Delete functionality still works

---

## Summary

**Data Sources**: MapContext from @geospatial-sdk/core (no custom types needed)

**New Types**: LayerMenuItem, type guards (isBasemapLayer, getLayerLabel)

**Component Interface**: Stateless, connects to Pinia store, no props/events

**Store Extension**: deleteLayer action with immutable updates

**Type Safety**: Full TypeScript coverage, strict mode compliant

**Performance**: Optimized for 1-50 layers (typical use case)
