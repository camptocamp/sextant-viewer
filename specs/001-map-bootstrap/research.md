# Research: Map Application Bootstrap

**Feature**: 001-map-bootstrap
**Date**: 2026-01-05
**Status**: Complete

## Research Questions

### Q1: Which geospatial-sdk packages are required for OpenLayers integration?

**Answer**: Three packages required:
- `@geospatial-sdk/core` - Core MapContext types and utilities (`MapContext`, `MapContextLayer`, `computeMapContextDiff`)
- `@geospatial-sdk/openlayers` - OpenLayers integration functions (`createMapFromContext`, `applyContextDiffToMap`)
- `ol` - OpenLayers library (peer dependency, version 10.0+)

**Source**: geospatial-sdk skill documentation, package.json from previous implementation

---

### Q2: What is the correct XYZ tile URL for OpenStreetMap?

**Answer**: `https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png`

**Attribution Required**: © OpenStreetMap contributors

**Alternative tile servers** (for future basemap options):
- Satellite: Various providers (Esri, MapBox, etc.) - requires API keys
- Topographic: OpenTopoMap `https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png`

**Source**: OpenStreetMap tile usage policy, geospatial-sdk examples

---

### Q3: What is the proper way to handle MapContextLayer union types in TypeScript strict mode?

**Answer**: The `MapContextLayer` type from geospatial-sdk is a discriminated union. Properties like `visibility`, `opacity`, and `id` may not exist on all layer types. Two approaches:

1. **Type guards and helper functions** (Recommended):
```typescript
function getLayerId(layer: MapContextLayer): string {
  return String(layer.id || '')
}

function isLayerVisible(layer: MapContextLayer): boolean {
  return (layer as any).visibility !== false
}
```

2. **Type assertions for immutable updates**:
```typescript
{ ...layer, visibility: false } as unknown as MapContextLayer
```

**Rationale**: This was previously validated in the full implementation. The geospatial-sdk uses union types for flexibility, requiring type assertions or guards when accessing optional properties.

**Source**: Previous implementation in map.store.ts, TypeScript handbook on discriminated unions

---

### Q4: How to prevent circular updates in bidirectional MapContext synchronization?

**Answer**: Use a flag to track update source:

```typescript
const isUpdatingFromMap = ref(false)

// When map moves, update store
function handleMoveEnd() {
  if (isUpdatingFromMap.value) return
  isUpdatingFromMap.value = true
  mapStore.setView({ center, zoom })
  isUpdatingFromMap.value = false
}

// When store changes, update map
watch(() => mapStore.context, (newContext, oldContext) => {
  if (isUpdatingFromMap.value) return
  const diff = computeMapContextDiff(oldContext, newContext)
  applyContextDiffToMap(map, diff)
})
```

**Rationale**: Without this flag, map updates trigger store updates which trigger map updates (infinite loop).

**Source**: Previous implementation in MapViewer.vue and useMapInteraction.ts, Vue.js reactivity patterns

---

### Q5: What MapContext structure should be used for the default OSM basemap?

**Answer**: MapContext with single XYZ layer and world view:

```typescript
const DEFAULT_MAP_CONTEXT: MapContext = {
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
    center: [0, 0],  // World center in EPSG:4326
    zoom: 2          // World view
  }
}
```

**Layer Type**: `xyz` (XYZ tile layer)
**Coordinate System**: EPSG:4326 (WGS84) for center coordinates
**Default View**: World view centered at [0, 0] with zoom level 2

**Source**: Feature specification (FR-002, assumption about default view), geospatial-sdk MapContext types

---

### Q6: Does the bootstrap phase require any composables?

**Answer**: No composables required for minimal bootstrap. The feature specification requires:
- Full-screen map display (MapViewer component)
- State management (Pinia store)
- Minimal state manipulation functions (addLayer, removeLayer, updateLayer in store)

Composables like `useMapInteraction`, `useMapView`, and `useLayerManagement` are useful for advanced features but not required for the bootstrap phase per FR-010 (no UI components).

**Decision**: Implement only the core store actions. Future features can extract logic into composables when needed (following Constitution Principle III: no premature abstraction).

**Source**: Feature specification FR-001 through FR-012, Constitution Principle III (rule of three)

---

### Q7: How to properly clean up OpenLayers map instance on component unmount?

**Answer**: Call `setTarget(undefined)` and clear references:

```typescript
onBeforeUnmount(() => {
  if (map) {
    map.setTarget(undefined)
    map = null
  }
  mapStore.setMapInstance(null)
})
```

**Rationale**: OpenLayers requires explicit cleanup to prevent memory leaks. Setting target to undefined removes the map from the DOM, and clearing references allows garbage collection.

**Source**: OpenLayers documentation, Vue.js lifecycle hooks best practices

---

### Q8: What CSS is required for full-screen map layout?

**Answer**: Three requirements:

1. **Import OpenLayers CSS** (in main.css):
```css
@import 'ol/ol.css';
```

2. **Full viewport layout** (in main.css):
```css
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

3. **Full-screen map container** (in MapViewer.vue):
```vue
<div ref="mapContainer" class="h-screen w-screen"></div>
```

**Rationale**: OpenLayers CSS provides default control styles and map canvas styling. Full viewport layout ensures the map fills the entire browser window (FR-001, SC-002).

**Source**: Feature specification SC-002, OpenLayers documentation, Tailwind CSS utilities

---

## Technical Unknowns Resolved

✅ All technical unknowns have been resolved through previous implementation and research.

## Dependencies Confirmed

**Production Dependencies**:
- `@geospatial-sdk/core` - Core MapContext types and utilities
- `@geospatial-sdk/openlayers` - OpenLayers integration
- `ol` - OpenLayers library (version 10.0+)
- `pinia` - State management (already installed)
- `vue` - Framework (already installed, version 3.5+)
- `vue-router` - Routing (already installed)

**Dev Dependencies** (already configured):
- `typescript` - Type checking (version 5.9+)
- `vite` - Build tool (version 7.0+)
- `@vitejs/plugin-vue` - Vite Vue plugin
- `tailwindcss` - Utility CSS framework (version 4.0+)

## Next Steps

Proceed to Phase 1: Design & Contracts
- Generate data-model.md (MapContext, Layer, View Configuration entities)
- Generate quickstart.md (developer guide)
- Evaluate if contracts/ directory is needed (likely N/A for bootstrap)
