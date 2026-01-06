# Data Model: Map Application Bootstrap

**Feature**: 001-map-bootstrap
**Date**: 2026-01-05
**Status**: Complete

## Overview

This feature introduces three core entities that represent the map application's state. All entities follow immutable update patterns and are managed through Pinia state management.

## Entities

### 1. MapContext

**Description**: The single source of truth for all map state. Contains the complete configuration needed to render and interact with the map.

**Source**: `@geospatial-sdk/core`

**Type Definition**:
```typescript
interface MapContext {
  layers: MapContextLayer[]
  view: MapContextView | null
}
```

**Properties**:
- `layers`: Ordered array of map layers (bottom to top rendering order)
- `view`: Viewport configuration (center/zoom or extent)

**Lifecycle**:
1. **Creation**: Initialized with DEFAULT_MAP_CONTEXT in Pinia store
2. **Updates**: Immutable updates create new MapContext objects
3. **Synchronization**: Changes detected via `computeMapContextDiff()` and applied via `applyContextDiffToMap()`

**Immutability Rules**:
```typescript
// ✅ CORRECT - creates new context
context.value = {
  ...context.value,
  layers: [...context.value.layers, newLayer]
}

// ❌ WRONG - mutates existing context
context.value.layers.push(newLayer)
```

**Storage**: Stored in Pinia `map.store.ts` as reactive ref

**Relationships**:
- Contains 0 to N `MapContextLayer` instances
- Contains 0 or 1 `MapContextView` instance

---

### 2. MapContextLayer (Union Type)

**Description**: Represents a visual layer on the map. This is a discriminated union type supporting multiple layer types (XYZ tiles, WMS, WMTS, GeoJSON, etc.).

**Source**: `@geospatial-sdk/core`

**Common Interface**:
```typescript
interface BaseLayer {
  id: string | number
  type: 'xyz' | 'wms' | 'wmts' | 'geojson' | 'wfs' | ...
  visible?: boolean
  opacity?: number
  label?: string
}
```

**XYZ Layer Type** (used for OSM basemap):
```typescript
interface MapContextLayerXyz {
  type: 'xyz'
  id: string | number
  url: string
  visible?: boolean
  opacity?: number
  label?: string
}
```

**Properties**:
- `type`: Discriminator for union type (determines available properties)
- `id`: Unique identifier for the layer
- `url`: Tile URL template (for XYZ layers)
- `visible`: Layer visibility (default: true)
- `opacity`: Layer opacity 0-1 (default: 1)
- `label`: Human-readable layer name

**Type Handling in TypeScript**:
Since MapContextLayer is a union type, accessing optional properties requires type guards or assertions:

```typescript
// Type guard helper
function isLayerVisible(layer: MapContextLayer): boolean {
  return (layer as any).visible !== false
}

// Type assertion for updates
const updatedLayer = {
  ...layer,
  visible: false
} as unknown as MapContextLayer
```

**Lifecycle**:
1. **Creation**: Created via store action `addLayer(layer)`
2. **Updates**: Immutable updates via store actions (updateLayer, toggleLayerVisibility, setLayerOpacity)
3. **Deletion**: Removed via `removeLayer(layerId)`

**Storage**: Stored in MapContext.layers array

**Relationships**:
- Belongs to one `MapContext`
- Rendered by OpenLayers map instance

---

### 3. MapContextView (Union Type)

**Description**: Defines the viewport configuration (what geographical area is visible and at what zoom level).

**Source**: `@geospatial-sdk/core`

**Type Definition**:
```typescript
type MapContextView = ViewByZoomAndCenter | ViewByExtent
```

**ViewByZoomAndCenter** (used for bootstrap):
```typescript
interface ViewByZoomAndCenter {
  center: [number, number]  // [longitude, latitude] in EPSG:4326
  zoom: number              // Zoom level (0 = world, higher = more zoomed in)
}
```

**ViewByExtent** (alternative):
```typescript
interface ViewByExtent {
  extent: [number, number, number, number]  // [minX, minY, maxX, maxY]
}
```

**Properties (ViewByZoomAndCenter)**:
- `center`: Geographic center point [longitude, latitude]
- `zoom`: Zoom level (integer or decimal)

**Default Values** (bootstrap):
```typescript
{
  center: [0, 0],  // World center
  zoom: 2          // World view
}
```

**Lifecycle**:
1. **Creation**: Initialized with default world view
2. **Updates**: Updated via store action `setView(view)` when user pans/zooms
3. **Synchronization**: Map `moveend` events update view in store

**Storage**: Stored in MapContext.view

**Relationships**:
- Belongs to one `MapContext`
- Controls OpenLayers View instance

---

## Default MapContext Configuration

**Location**: `src/utils/map-config.ts`

```typescript
export const DEFAULT_MAP_CONTEXT: MapContext = {
  layers: [
    {
      type: 'xyz',
      id: 'basemap-osm',
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      visible: true,
      opacity: 1,
      label: 'OpenStreetMap'
    }
  ],
  view: {
    center: [0, 0],
    zoom: 2
  }
}
```

**Rationale**: Meets FR-002 (OpenStreetMap as default base layer) and assumption about default world view.

---

## State Management Flow

```
User Interaction (pan/zoom)
  ↓
OpenLayers Map Event (moveend)
  ↓
Store Action (setView)
  ↓
MapContext Updated (immutable)
  ↓
Watcher Triggered
  ↓
computeMapContextDiff()
  ↓
applyContextDiffToMap()
  ↓
OpenLayers Map Updates
```

**Circular Update Prevention**: `isUpdatingFromMap` flag prevents infinite loops

---

## Store Actions (API)

**Minimal functions required by feature specification**:

### addLayer(layer: MapContextLayer): void
Adds a new layer to the map context.

**Immutable Update**:
```typescript
context.value = {
  ...context.value,
  layers: [...context.value.layers, layer]
}
```

---

### removeLayer(layerId: string): void
Removes a layer from the map context by ID.

**Immutable Update**:
```typescript
context.value = {
  ...context.value,
  layers: context.value.layers.filter(l => getLayerId(l) !== layerId)
}
```

---

### updateLayer(layerId: string, updates: Partial<MapContextLayer>): void
Updates specific properties of a layer.

**Immutable Update**:
```typescript
context.value = {
  ...context.value,
  layers: context.value.layers.map(layer =>
    getLayerId(layer) === layerId
      ? ({ ...layer, ...updates } as unknown as MapContextLayer)
      : layer
  )
}
```

---

### setView(view: MapContextView): void
Updates the viewport configuration.

**Immutable Update**:
```typescript
context.value = {
  ...context.value,
  view
}
```

---

## Type Imports

```typescript
// Core types
import type {
  MapContext,
  MapContextLayer,
  MapContextView
} from '@geospatial-sdk/core'

// Functions
import {
  createMapFromContext,
  applyContextDiffToMap
} from '@geospatial-sdk/openlayers'

import {
  computeMapContextDiff
} from '@geospatial-sdk/core'

// OpenLayers types
import type Map from 'ol/Map'
```

---

## Validation Against Requirements

✅ **FR-003**: MapContext provides centralized state management
✅ **FR-004**: `addLayer()` action supports adding layers
✅ **FR-005**: `removeLayer()` action supports removing layers
✅ **FR-006**: `updateLayer()` action supports updating layer properties
✅ **FR-011**: MapContext.view persists current view configuration
✅ **Constitution Principle I**: MapContext as single source of truth

---

## Future Enhancements

The data model is designed to support future features:
- **Layer Reordering**: Move layers up/down in rendering order
- **Layer Groups**: Organize layers into collapsible groups
- **View Animation**: Smooth transitions between view states
- **Context Serialization**: Save/load map configurations from JSON
- **Context Sharing**: Generate shareable URLs with map state
