---
name: geospatial-sdk-integration
description: Helper for integrating Camptocamp geospatial-sdk into VueJs applications with Pinia state management. Use when setting up maps, working with MapContext, binding map state to Pinia stores, or syncing application state with geospatial layers. Triggers include mentions of geospatial-sdk, MapContext, map integration, Pinia binding, or Vue map setup.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# Geospatial SDK Integration for VueJs + Pinia

This Skill helps you integrate the [Camptocamp geospatial-sdk](https://github.com/camptocamp/geospatial-sdk) into Vue.js applications using Pinia for state management, with **MapContext as the single source of truth** for map state.

**Rely on utils from core package when possible** eg. `createViewFromLayer`

## Core Concept: MapContext as Source of Truth

The geospatial-sdk is built around **MapContext**, an immutable data structure that represents the complete state of your map. Your application architecture should treat MapContext as the source of truth, and bind your Pinia state to it.

You must avoid using the native map library method to manage the layers or the view, you must pass by the state stored in Pinia.

### What is MapContext?

MapContext is a TypeScript interface that contains:
- **layers**: An ordered array of map layers (WMS, WMTS, GeoJSON, XYZ tiles, etc.)
- **view**: The viewport configuration (center, zoom, or extent)

```typescript
interface MapContext {
  layers: MapContextLayer[]
  view: MapContextView | null
}
```

**Key Characteristics:**
- Immutable data structure (create new instances for changes)
- Serializable to JSON (can be saved, shared, or persisted)
- Framework-agnostic (works with any mapping library)
- Supports change detection through MapContextDiff

## Installation

### 1. Install SDK Packages

The SDK is a monorepo with scoped packages. Install the ones you need:

```bash
# Core package (required)
npm install @geospatial-sdk/core

# Choose your map library integration
npm install @geospatial-sdk/openlayers
# OR
npm install @geospatial-sdk/maplibre

# Optional packages
npm install @geospatial-sdk/legend
npm install @geospatial-sdk/geocoding
```

### 2. Install Map Library Peer Dependencies

Depending on your choice:

```bash
# For OpenLayers
npm install ol

# For MapLibre GL
npm install maplibre-gl
```

## Architecture Pattern: MapContext + Pinia

### Recommended State Flow

```
User Action → Pinia Store → Update MapContext → Map Updates
                ↑                                      ↓
                └─────────── Map Events ───────────────┘
```

**The MapContext lives in your Pinia store** and serves as the single source of truth. The map library (OpenLayers/MapLibre) renders based on this context.

### Pinia Store Structure

Create a dedicated store for map state:

**Best Practices:**
- Use `.store.ts` naming convention for clarity (e.g., `map.store.ts`)
- Add explicit type annotations with `type Ref` for better IDE support
- Use `type` imports for type-only imports (tree-shaking optimization)

```typescript
// src/stores/map.store.ts
import { type Ref, ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MapContext, MapContextLayer } from '@geospatial-sdk/core'

export const useMapStore = defineStore('map', () => {
  // State: MapContext is the source of truth
  const context: Ref<MapContext> = ref({
    layers: [],
    view: null
  })

  // Optional: track map instance separately
  const mapInstance = ref<any>(null)

  // Getters: Derived state using computed
  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)
  const visibleLayers = computed(() =>
    context.value.layers.filter((layer) => layer.visible !== false)
  )

  // Actions: Immutable updates to context
  function setContext(newContext: MapContext) {
    context.value = { ...newContext }
  }

  function addLayer(layer: MapContextLayer) {
    context.value = {
      ...context.value,
      layers: [...context.value.layers, layer]
    }
  }

  function removeLayer(layerId: string) {
    context.value = {
      ...context.value,
      layers: context.value.layers.filter((l) => l.id !== layerId)
    }
  }

  function toggleLayerVisibility(layerId: string) {
    context.value = {
      ...context.value,
      layers: context.value.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    }
  }

  function setView(view: MapContext['view']) {
    context.value = {
      ...context.value,
      view
    }
  }

  function setMapInstance(instance: any) {
    mapInstance.value = instance
  }

  return {
    context,
    mapInstance,
    layers,
    view,
    visibleLayers,
    setContext,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    setView,
    setMapInstance
  }
})
```

## Integration with Map Component

### Vue Component Pattern

Create a map component that renders based on MapContext:

**Key Points:**
- Import `MapContext` type from core for watch callback type annotation
- Use Tailwind CSS utility classes (`h-screen w-screen`) for full viewport
- Add `isUpdatingFromMap` flag to prevent circular updates in bidirectional sync
- OnMounted: Initialize map from context
- When context changes, compute diff and apply to map

```vue
<!-- src/views/MapView.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { createMapFromContext, applyContextDiffToMap } from '@geospatial-sdk/openlayers'
import { computeMapContextDiff, type MapContext } from '@geospatial-sdk/core'
import type Map from 'ol/Map'
import 'ol/ol.css'

const mapStore = useMapStore()
const { context } = storeToRefs(mapStore)
const mapContainer = ref<HTMLElement>()
let map: Map | null = null
let isUpdatingFromMap = false // Prevent circular updates

onMounted(() => {
  if (!mapContainer.value) return

  // Initialize OpenLayers map with SDK
  map = createMapFromContext(context.value, mapContainer.value)

  // Store map instance
  mapStore.setMapInstance(map)

  // Listen to map view changes (pan, zoom) for bidirectional sync
  map.on('moveend', () => {
    if (!map || isUpdatingFromMap) return

    isUpdatingFromMap = true

    const view = map.getView()
    const center = view.getCenter()
    const zoom = view.getZoom()

    if (center && zoom !== undefined) {
      // Update Pinia store (bidirectional sync)
      mapStore.setView({
        center: center as [number, number],
        zoom: zoom
      })
    }

    isUpdatingFromMap = false
  })
})

// Watch for MapContext changes from Pinia store
watch(
  context,
  (newContext: MapContext, oldContext: MapContext) => {
    if (!map || isUpdatingFromMap) return

    // Compute diff and apply changes
    const diff = computeMapContextDiff(newContext, oldContext)
    applyContextDiffToMap(map, diff)
  },
  { deep: false }
)

onUnmounted(() => {
  // Clean up map instance
  if (map) {
    map.setTarget(undefined)
    map = null
  }
})
</script>

<template>
  <div ref="mapContainer" class="h-screen w-screen"></div>
</template>

<style scoped>
</style>
```

## Working with MapContext

### Layer Types

MapContext supports various layer types:

```typescript
import type {
  MapContextLayerWms,
  MapContextLayerGeojson,
  MapContextLayerXyz
} from '@geospatial-sdk/core'

// WMS Layer
const wmsLayer: MapContextLayerWms = {
  type: 'wms',
  id: 'my-wms-layer',
  url: 'https://example.com/wms',
  name: 'layer_name',
  visibility: true,
  opacity: 1,
  label: 'My WMS Layer'
}

// GeoJSON Layer
const geojsonLayer: MapContextLayerGeojson = {
  type: 'geojson',
  id: 'my-geojson-layer',
  data: {
    type: 'FeatureCollection',
    features: []
  },
  visibility: true,
  style: {
    // Vector styling
  }
}

// XYZ Tile Layer
const xyzLayer: MapContextLayerXyz = {
  type: 'xyz',
  id: 'basemap',
  url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  visibility: true
}
```

### View Configuration

```typescript
import type { ViewByZoomAndCenter, ViewByExtent } from '@geospatial-sdk/core'

// View by zoom and center
const viewByCenter: ViewByZoomAndCenter = {
  center: [6.5, 46.5], // [lon, lat]
  zoom: 8
}

// View by extent
const viewByExtent: ViewByExtent = {
  extent: [5.5, 45.5, 7.5, 47.5] // [minX, minY, maxX, maxY]
}
```

### Change Detection

The SDK provides MapContextDiff for efficient change tracking:

```typescript
import { computeMapContextDiff } from '@geospatial-sdk/core'

// In your Pinia store or watcher
const diff = computeMapContextDiff(oldContext, newContext)

// diff contains:
// - layersAdded: new layers
// - layersRemoved: deleted layers
// - layersChanged: modified layers
// - layersReordered: position changes
// - viewChanges: viewport changes
```

## Common Integration Patterns

### Pattern 1: Initialize with Default MapContext

```typescript
// src/stores/map.store.ts
import { type Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import type { MapContext } from '@geospatial-sdk/core'

export const useMapStore = defineStore('map', () => {
  const context: Ref<MapContext> = ref({
    layers: [
      {
        type: 'xyz',
        id: 'osm-basemap',
        url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        visible: true,
        label: 'OpenStreetMap'
      }
    ],
    view: {
      center: [0, 0],
      zoom: 2
    }
  })

  // ... other state, getters, and actions

  return { context /* ... */ }
})
```

### Pattern 2: Load MapContext from API

```typescript
// In your store action
async function loadMapContext(contextId: string) {
  const response = await fetch(`/api/map-contexts/${contextId}`)
  const loadedContext = await response.json()
  setContext(loadedContext)
}
```

### Pattern 3: Persist MapContext

```typescript
// Save current map state
async function saveMapContext() {
  await fetch('/api/map-contexts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context.value)
  })
}
```

### Pattern 4: Sync User Interactions Back to Pinia

```typescript
// In your map component
map.on('map-extent-change', (event) => {
  mapStore.setView({ extent: event.extent })
})

map.on('features-click', (event) => {
  // Store selected features in Pinia
  // selectionStore.setSelected(event.features)
})
```

## Event System

The SDK provides typed events:

```typescript
import type {
  FeaturesClickEvent,
  FeaturesHoverEvent,
  MapClickEvent,
  MapExtentChangeEvent,
  SourceLoadErrorEvent
} from '@geospatial-sdk/core'

// Available events:
// - 'features-click': User clicks on features
// - 'features-hover': User hovers over features
// - 'map-click': User clicks on empty map area
// - 'map-extent-change': Map viewport changes
// - 'source-load-error': Layer fails to load
```

## Best Practices

### 1. Keep MapContext Immutable

Always create new objects when updating:

```typescript
// ✅ Good: Creates new context
context.value = {
  ...context.value,
  layers: [...context.value.layers, newLayer]
}

// ❌ Bad: Mutates existing context
context.value.layers.push(newLayer)
```

### 2. Use MapContext as Single Source of Truth

Don't duplicate state. Derive everything from MapContext:

```typescript
// ✅ Good: Derive from MapContext using computed
const activeLayer = computed(() =>
  context.value.layers.find((l) => l.id === activeLayerId.value)
)

// ❌ Bad: Duplicate layer data
const context = ref<MapContext>({ layers: [...] })
const activeLayerCopy = ref(null) // Avoid this!
```

### 3. Batch Updates

When making multiple changes, update context once:

```typescript
// ✅ Good: Single update
function updateMultipleLayers(updates: Array<{ id: string; opacity: number }>) {
  context.value = {
    ...context.value,
    layers: context.value.layers.map((layer) => {
      const update = updates.find((u) => u.id === layer.id)
      return update ? { ...layer, opacity: update.opacity } : layer
    })
  }
}

// ❌ Bad: Multiple updates
updates.forEach((update) => {
  updateLayerOpacity(update.id, update.opacity)
})
```

### 4. Leverage TypeScript

Use the SDK's types for compile-time safety:

```typescript
import type { MapContextLayer } from '@geospatial-sdk/core'

function addLayer(layer: MapContextLayer) {
  // TypeScript ensures layer has required properties
}
```

### 5. Separate Concerns

- **Pinia Store**: Manages MapContext state
- **Map Component**: Renders map based on context
- **UI Components**: Read from store, dispatch actions to update

## Debugging

### View Current MapContext

```typescript
// In Vue DevTools or console
const mapStore = useMapStore()
console.log(JSON.stringify(mapStore.context, null, 2))
```

### Watch for Changes

```typescript
// In your component
watch(
  () => mapStore.context,
  (newContext, oldContext) => {
    console.log('Context changed:', { old: oldContext, new: newContext })
  },
  { deep: true }
)
```

## Common Tasks

### Task: Set up a new map in Vue.js project

1. Install packages: `@geospatial-sdk/core` + map library package
2. Create Pinia store with MapContext state
3. Create Vue map component
4. Initialize map from MapContext in `onMounted`
5. Watch context changes and update map

### Task: Add a new layer

1. Create layer configuration object with proper type
2. Call store action: `mapStore.addLayer(layer)`
3. Map updates automatically via watcher

### Task: Toggle layer visibility

1. Call store action: `mapStore.toggleLayerVisibility(layerId)`
2. MapContext updates with new layer visibility
3. Map re-renders affected layer

### Task: Persist map state

1. Extract MapContext from store: `mapStore.context`
2. Serialize to JSON: `JSON.stringify(context)`
3. Save to localStorage, API, or database
4. Load: Parse JSON and call `mapStore.setContext(loadedContext)`

### Task: Sync map view to URL params

```typescript
// In your router or component
watch(
  () => mapStore.context.view,
  (view) => {
    if (view && 'center' in view) {
      router.push({
        query: {
          lon: view.center[0],
          lat: view.center[1],
          zoom: view.zoom
        }
      })
    }
  }
)
```

## Resources

- **Repository**: https://github.com/camptocamp/geospatial-sdk
- **Core Package**: `@geospatial-sdk/core`
- **OpenLayers Integration**: `@geospatial-sdk/openlayers`
- **MapLibre Integration**: `@geospatial-sdk/maplibre`
- **Local Docs**: Clone repo and run `npm run docs:dev`

## When to Use This Skill

Use this Skill when:
- Setting up geospatial-sdk in a Vue.js application
- Creating or configuring Pinia stores for map state
- Working with MapContext structure or layer configurations
- Binding map state to Vue components
- Implementing map event handlers
- Debugging MapContext synchronization issues
- Following best practices for immutable state management
- Integrating with OpenLayers or MapLibre GL
