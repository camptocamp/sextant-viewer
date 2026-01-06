# Quickstart: Map Application Bootstrap

**Feature**: 001-map-bootstrap
**Audience**: Developers
**Date**: 2026-01-05

## Overview

This guide helps you understand and work with the map bootstrap implementation. The application displays a full-screen map with OpenStreetMap as the base layer, using geospatial-sdk's MapContext pattern for state management.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│          MapView.vue (Route)            │
│  ┌───────────────────────────────────┐  │
│  │   MapViewer.vue (Full-screen)     │  │
│  │   - Renders OpenLayers map        │  │
│  │   - Syncs with Pinia store        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↕ (reactive)
┌─────────────────────────────────────────┐
│      map.store.ts (Pinia Store)         │
│  - MapContext (single source of truth)  │
│  - Map instance reference               │
│  - Actions: addLayer, removeLayer, etc. │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│   map-config.ts (Configuration)         │
│  - DEFAULT_MAP_CONTEXT                  │
│  - OSM basemap layer definition         │
└─────────────────────────────────────────┘
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

**Key packages installed**:
- `@geospatial-sdk/core@dev` - MapContext types and utilities
- `@geospatial-sdk/openlayers@dev` - OpenLayers integration
- `ol` - OpenLayers map library
- `pinia` - State management
- `vue` - Framework

### 2. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 - you should see a full-screen map with OpenStreetMap basemap centered on the world.

### 3. Build for Production

```bash
npm run build
```

## Key Files

### Core Files (Must Read)

1. **src/stores/map.store.ts** - Pinia store with MapContext state
   - Contains all map state management logic
   - Implements immutable update patterns
   - Provides actions: addLayer, removeLayer, updateLayer, setView

2. **src/components/map/MapViewer.vue** - Full-screen map component
   - Initializes OpenLayers map from MapContext
   - Implements bidirectional synchronization
   - Handles map lifecycle (mount/unmount)

3. **src/utils/map-config.ts** - Default MapContext configuration
   - Defines initial map state (OSM basemap, world view)

### Supporting Files

4. **src/views/MapView.vue** - Route wrapper for MapViewer
5. **src/router/index.ts** - Vue Router configuration (single route to MapView)
6. **src/App.vue** - Application root (minimal wrapper)
7. **src/assets/main.css** - Global styles (full viewport layout, OpenLayers CSS)

## Understanding MapContext

**MapContext** is the single source of truth for all map state. It's an immutable data structure stored in Pinia.

### Structure

```typescript
interface MapContext {
  layers: MapContextLayer[]  // Ordered array (bottom to top)
  view: MapContextView | null  // Viewport configuration
}
```

### Example MapContext

```typescript
{
  layers: [
    {
      type: 'xyz',
      id: 'basemap-osm',
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      visibility: true,
      opacity: 1,
      label: 'OpenStreetMap'
    }
  ],
  view: {
    center: [0, 0],  // [longitude, latitude]
    zoom: 2          // Zoom level
  }
}
```

## Common Tasks

### Task: Add a New Layer

```typescript
import { useMapStore } from '@/stores/map.store'

const mapStore = useMapStore()

// Add a GeoJSON layer
mapStore.addLayer({
  type: 'geojson',
  id: 'my-layer',
  data: {
    type: 'FeatureCollection',
    features: [/* ... */]
  },
  visibility: true,
  opacity: 1
})
```

### Task: Remove a Layer

```typescript
mapStore.removeLayer('my-layer')
```

### Task: Update Layer Properties

```typescript
// Toggle visibility
mapStore.updateLayer('basemap-osm', { visibility: false })

// Change opacity
mapStore.updateLayer('basemap-osm', { opacity: 0.5 })

// Update multiple properties
mapStore.updateLayer('my-layer', {
  visibility: true,
  opacity: 0.8
})
```

### Task: Change Map View Programmatically

```typescript
// Center on specific location with zoom
mapStore.setView({
  center: [6.5, 46.5],  // Switzerland
  zoom: 8
})

// Or use extent (bounding box)
mapStore.setView({
  extent: [5.5, 45.5, 7.5, 47.5]  // [minX, minY, maxX, maxY]
})
```

### Task: Access Current Map State

```typescript
const mapStore = useMapStore()

// Get all layers
console.log(mapStore.layers)

// Get current view
console.log(mapStore.view)

// Get full context
console.log(mapStore.context)

// Get map instance (for advanced OpenLayers operations)
const map = mapStore.mapInstance
```

### Task: Access Map Instance Directly (Advanced)

For operations not supported by MapContext (e.g., custom controls, interactions):

```typescript
const mapStore = useMapStore()
const map = mapStore.mapInstance

// Add custom interaction
import Draw from 'ol/interaction/Draw'
const draw = new Draw({ type: 'Point' })
map.addInteraction(draw)

// Access OpenLayers View
const view = map.getView()
view.animate({ zoom: 10, duration: 1000 })
```

**⚠️ Warning**: Direct map instance manipulation bypasses MapContext synchronization. Use sparingly and only when necessary.

## State Synchronization

The application implements **bidirectional synchronization**:

### Map → Store (User Interactions)

When the user pans or zooms:
1. OpenLayers fires `moveend` event
2. Event handler updates Pinia store via `setView()`
3. MapContext is updated immutably

### Store → Map (Programmatic Changes)

When you call store actions:
1. MapContext is updated immutably
2. Watcher detects change
3. `computeMapContextDiff()` computes differences
4. `applyContextDiffToMap()` updates OpenLayers map

### Circular Update Prevention

The `isUpdatingFromMap` flag prevents infinite loops:

```typescript
// In MapViewer.vue
const isUpdatingFromMap = ref(false)

// Map event handler
map.on('moveend', () => {
  if (isUpdatingFromMap.value) return  // Prevent loop
  isUpdatingFromMap.value = true
  mapStore.setView({ center, zoom })
  isUpdatingFromMap.value = false
})

// Store watcher
watch(() => mapStore.context, (newContext, oldContext) => {
  if (isUpdatingFromMap.value) return  // Prevent loop
  const diff = computeMapContextDiff(oldContext, newContext)
  applyContextDiffToMap(map, diff)
})
```

## Immutability Rules

**Always create new objects when updating MapContext**:

```typescript
// ✅ CORRECT - creates new context
context.value = {
  ...context.value,
  layers: [...context.value.layers, newLayer]
}

// ❌ WRONG - mutates existing context
context.value.layers.push(newLayer)
```

**Why?**: Vue's reactivity system and geospatial-sdk's diff algorithm rely on reference equality to detect changes.

## TypeScript Type Handling

`MapContextLayer` is a union type. Accessing optional properties requires type guards or assertions:

```typescript
// Helper function (already defined in map.store.ts)
function getLayerId(layer: MapContextLayer): string {
  return String(layer.id || '')
}

function isLayerVisible(layer: MapContextLayer): boolean {
  return (layer as any).visibility !== false
}

// Type assertion for updates
const updatedLayer = {
  ...layer,
  visibility: false
} as unknown as MapContextLayer
```

## Debugging Tips

### 1. Inspect MapContext in Vue DevTools

Install Vue DevTools browser extension, then:
1. Open DevTools
2. Navigate to "Pinia" tab
3. Select "map" store
4. Inspect `context`, `layers`, `view` state

### 2. Console Logging

```typescript
// In your component
import { useMapStore } from '@/stores/map.store'
const mapStore = useMapStore()

// Watch for all context changes
watch(() => mapStore.context, (newContext) => {
  console.log('MapContext changed:', newContext)
}, { deep: true })
```

### 3. Check Map Instance

```typescript
const map = mapStore.mapInstance
console.log('OpenLayers Map:', map)
console.log('Current View:', map.getView())
console.log('Layers:', map.getLayers().getArray())
```

## Performance Considerations

### Map Loading

**Expected**: Map interactive within 3 seconds on standard broadband (SC-001)

**If slow**:
- Check network tab for tile loading
- Verify OSM tile server is reachable
- Check for JavaScript errors in console

### Pan/Zoom Performance

**Expected**: 60 fps smooth animations (SC-003)

**If laggy**:
- Check browser hardware acceleration
- Reduce layer count if multiple layers added
- Verify no infinite update loops (check `isUpdatingFromMap` flag)

### State Update Reflection

**Expected**: Store changes reflected on map within 100ms (SC-004)

**If delayed**:
- Check watcher is triggering (add console.log)
- Verify `computeMapContextDiff()` is called
- Check for TypeScript errors preventing updates

## Testing

### Manual Testing Checklist

✅ Map loads and displays full-screen
✅ OpenStreetMap tiles load successfully
✅ Pan with mouse drag works smoothly
✅ Zoom with mouse wheel works smoothly
✅ Browser resize adjusts map size automatically
✅ Console has no errors

### Programmatic Testing

```typescript
// In browser console or component
const mapStore = useMapStore()

// Test addLayer
mapStore.addLayer({
  type: 'xyz',
  id: 'test-layer',
  url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
  visibility: true,
  opacity: 0.5
})

// Verify layer was added
console.log(mapStore.layers.length)  // Should be 2

// Test removeLayer
mapStore.removeLayer('test-layer')

// Verify layer was removed
console.log(mapStore.layers.length)  // Should be 1

// Test setView
mapStore.setView({ center: [2.35, 48.86], zoom: 12 })  // Paris

// Test updateLayer
mapStore.updateLayer('basemap-osm', { opacity: 0.7 })
```

## Troubleshooting

### Map doesn't display

**Possible causes**:
1. OpenLayers CSS not imported
   - **Fix**: Verify `@import 'ol/ol.css'` in `src/assets/main.css`

2. Container has no height
   - **Fix**: Verify `h-screen w-screen` classes on map container

3. Dependencies not installed
   - **Fix**: Run `npm install`

### Map doesn't update when store changes

**Possible causes**:
1. Not using immutable updates
   - **Fix**: Use spread operators to create new objects

2. Watcher not triggering
   - **Fix**: Verify `{ deep: true }` option on watcher

3. Circular update loop
   - **Fix**: Check `isUpdatingFromMap` flag implementation

## Next Steps

Now that you understand the bootstrap implementation, you can:

1. **Add UI Components**: Create layer panels, basemap switchers, toolbars (see full implementation plan for examples)
2. **Add Composables**: Extract reusable logic into `useMapInteraction`, `useMapView`, `useLayerManagement`
3. **Add More Layer Types**: WMS, WMTS, GeoJSON layers
4. **Add Feature Interaction**: Click handlers, tooltips, feature selection
5. **Persist State**: Save/load MapContext from localStorage or API

## Reference Documentation

- **geospatial-sdk**: Clone https://github.com/camptocamp/geospatial-sdk and run `npm run docs:dev`
- **OpenLayers**: https://openlayers.org/en/latest/apidoc/
- **Vue 3**: https://vuejs.org/guide/
- **Pinia**: https://pinia.vuejs.org/
- **Tailwind CSS**: https://tailwindcss.com/docs

## Constitution Alignment

This implementation follows all 7 constitution principles:
- ✅ **MapContext as Source of Truth**: All state in Pinia MapContext
- ✅ **Vue.js Best Practices**: Composition API, `<script setup>`, Pinia
- ✅ **Clean Code**: Single responsibilities, clear naming
- ✅ **Component Architecture**: Minimal bootstrap, ready for atomic expansion
- ✅ **TypeScript-First**: Strict mode, explicit types
- ✅ **Geospatial-SDK Integration**: Uses all core utilities
- ✅ **Software Craftsmanship**: Quality code, immutable patterns

## Support

For questions or issues:
1. Check this quickstart guide
2. Review the data model documentation (`data-model.md`)
3. Review the feature specification (`spec.md`)
4. Check the project constitution (`.specify/memory/constitution.md`)
