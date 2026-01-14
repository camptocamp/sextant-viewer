# Data Model: STAC Layer Support

**Feature**: 005-stac-layer-support  
**Date**: 2026-01-14  
**Status**: Complete

## Overview

This document defines the data structures and relationships for STAC layer support. The model extends the existing MapContext architecture by introducing a `MapLayerStac` type that coexists with standard `MapContextLayer` types.

## Core Entities

### MapLayerStac

Represents a STAC collection layer with associated filter state, pagination metadata, and cached items.

**Properties**:

| Property             | Type                             | Required | Description                               |
| -------------------- | -------------------------------- | -------- | ----------------------------------------- |
| `type`               | `'stac'`                         | ✅       | Layer type discriminator                  |
| `id`                 | `string`                         | ✅       | Unique layer identifier                   |
| `url`                | `string`                         | ✅       | STAC collection URL                       |
| `collectionId`       | `string`                         | ✅       | STAC collection identifier                |
| `label`              | `string`                         | ✅       | Human-readable layer name                 |
| `visibility`         | `boolean`                        | ✅       | Whether layer is visible                  |
| `version`            | `number`                         | ✅       | Layer version for change tracking         |
| `filters`            | `StacFilters`                    | ✅       | Current filter configuration              |
| `pagination`         | `StacPagination`                 | ✅       | Pagination state                          |
| `items`              | `GeoJSON.Feature[]`              | ✅       | Cached STAC items (empty array initially) |
| `loading`            | `boolean`                        | ✅       | Whether items are being fetched           |
| `error`              | `string \| null`                 | ✅       | Error message if fetch failed             |
| `collectionMetadata` | `StacCollectionMetadata \| null` | ❌       | Collection metadata from STAC API         |

**Relationships**:

- Extends conceptually from `MapContextLayer` (shares common properties)
- Contains `StacFilters` (composition)
- Contains `StacPagination` (composition)
- Contains array of GeoJSON Features (items)

**Validation Rules**:

- `url` must be valid HTTP(S) URL
- `collectionId` must be non-empty string
- `label` must be non-empty string
- `version` must be non-negative integer
- `items` must be valid GeoJSON Feature array

**State Transitions**:

```
Initial → Loading → Loaded
            ↓
          Error → Loading (retry)

Loaded → Loading (filter change)
Loaded → Loading (pagination)
```

**Example**:

```typescript
const stacLayer: MapLayerStac = {
  type: 'stac',
  id: 'stac-sentinel2-1234',
  url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr',
  collectionId: 'sentinel-2-radiometric-indices',
  label: 'Sentinel-2 Radiometric Indices',
  visibility: true,
  version: 0,
  filters: {
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    },
    spatialExtent: {
      enabled: true,
      bbox: [-5.0, 48.0, 10.0, 52.0]
    }
  },
  pagination: {
    currentPage: 1,
    totalItems: 847,
    itemsPerPage: 50,
    nextLink: 'https://...?page=2',
    prevLink: null
  },
  items: [...], // GeoJSON Features
  loading: false,
  error: null,
  collectionMetadata: {
    title: 'Sentinel-2 Radiometric Indices',
    description: '...',
    extent: {...}
  }
}
```

---

### StacFilters

Encapsulates filter criteria for STAC items.

**Properties**:

| Property        | Type                  | Required | Description                   |
| --------------- | --------------------- | -------- | ----------------------------- |
| `dateRange`     | `DateRangeFilter`     | ✅       | Temporal filter configuration |
| `spatialExtent` | `SpatialExtentFilter` | ✅       | Spatial filter configuration  |

**Relationships**:

- Owned by `MapLayerStac`
- Contains `DateRangeFilter` (composition)
- Contains `SpatialExtentFilter` (composition)

**Validation Rules**:

- Both sub-filters must be present (even if inactive)
- `dateRange.start` should be before or equal to `dateRange.end` (when both set)
- `spatialExtent.bbox` must be valid [west, south, east, north] when enabled

---

### DateRangeFilter

Temporal filter for STAC items based on datetime property.

**Properties**:

| Property | Type           | Required | Description                                        |
| -------- | -------------- | -------- | -------------------------------------------------- |
| `start`  | `Date \| null` | ✅       | Start date (inclusive), null = no start constraint |
| `end`    | `Date \| null` | ✅       | End date (inclusive), null = no end constraint     |

**Validation Rules**:

- Both `start` and `end` null = no temporal filter applied
- `start` must be ≤ `end` when both are set
- Dates must be valid Date objects (not Invalid Date)

**Filter Active**: When `start !== null || end !== null`

**STAC API Format**: Converts to ISO 8601 for `datetime` parameter

- Both set: `datetime=2024-01-01T00:00:00Z/2024-12-31T23:59:59Z`
- Only start: `datetime=2024-01-01T00:00:00Z/..`
- Only end: `datetime=../2024-12-31T23:59:59Z`

---

### SpatialExtentFilter

Spatial filter for STAC items based on bounding box intersection.

**Properties**:

| Property  | Type               | Required | Description                                      |
| --------- | ------------------ | -------- | ------------------------------------------------ |
| `enabled` | `boolean`          | ✅       | Whether spatial filter is active                 |
| `bbox`    | `number[] \| null` | ✅       | Bounding box [west, south, east, north] in WGS84 |

**Validation Rules**:

- `bbox` must be 4-element array when `enabled` is true
- `bbox` format: `[west, south, east, north]` (minLon, minLat, maxLon, maxLat)
- Longitude: -180 to 180
- Latitude: -90 to 90
- `west` must be < `east`
- `south` must be < `north`

**Filter Active**: When `enabled === true && bbox !== null`

**STAC API Format**: Passed directly as `bbox` parameter (comma-separated)

- Example: `bbox=-5.0,48.0,10.0,52.0`

---

### StacPagination

Pagination state and navigation links for STAC item results.

**Properties**:

| Property       | Type             | Required | Description                                         |
| -------------- | ---------------- | -------- | --------------------------------------------------- |
| `currentPage`  | `number`         | ✅       | Current page number (1-indexed)                     |
| `totalItems`   | `number \| null` | ✅       | Total item count (null if unknown)                  |
| `itemsPerPage` | `number`         | ✅       | Items per page (default: 50)                        |
| `nextLink`     | `string \| null` | ✅       | STAC API link to next page (null if last page)      |
| `prevLink`     | `string \| null` | ✅       | STAC API link to previous page (null if first page) |

**Relationships**:

- Owned by `MapLayerStac`
- Links reference STAC API endpoints (external)

**Validation Rules**:

- `currentPage` must be positive integer ≥ 1
- `totalItems` must be non-negative integer when set
- `itemsPerPage` must be positive integer (typically 10-100)
- `nextLink` and `prevLink` must be valid URLs when set

**Computed Properties**:

- `hasNextPage`: `nextLink !== null`
- `hasPrevPage`: `prevLink !== null`
- `totalPages`: `totalItems !== null ? Math.ceil(totalItems / itemsPerPage) : null`

**State Transitions**:

- First page: `prevLink = null`
- Last page: `nextLink = null`
- Middle pages: Both links present
- Reset to page 1 when filters change

---

### StacCollectionMetadata

Metadata about the STAC collection (optional, for display purposes).

**Properties**:

| Property      | Type         | Required | Description                        |
| ------------- | ------------ | -------- | ---------------------------------- |
| `title`       | `string`     | ❌       | Collection title                   |
| `description` | `string`     | ❌       | Collection description             |
| `license`     | `string`     | ❌       | Data license                       |
| `extent`      | `StacExtent` | ❌       | Collection spatial/temporal extent |
| `keywords`    | `string[]`   | ❌       | Collection keywords                |

**Usage**: Displayed in layer details panel, not used for filtering logic

---

### MapLayer (Union Type)

Union type combining standard MapContext layers with STAC layers.

**Definition**:

```typescript
type MapLayer = MapContextLayer | MapLayerStac
```

**Type Guards**:

```typescript
function isStacLayer(layer: MapLayer): layer is MapLayerStac {
  return layer.type === 'stac'
}

function isMapContextLayer(layer: MapLayer): layer is MapContextLayer {
  return layer.type !== 'stac'
}
```

**Usage**: Internal representation in `map.store.ts`

---

## Relationships Diagram

```
MapStore
  ├── internalLayers: MapLayer[]
  │     ├── MapContextLayer (wms, wmts, xyz, geojson, etc.)
  │     └── MapLayerStac
  │           ├── filters: StacFilters
  │           │     ├── dateRange: DateRangeFilter
  │           │     └── spatialExtent: SpatialExtentFilter
  │           ├── pagination: StacPagination
  │           ├── items: GeoJSON.Feature[]
  │           └── collectionMetadata: StacCollectionMetadata
  │
  └── context: Computed<MapContext>
        └── layers: MapContextLayer[]  (STAC mapped to geojson)
```

## Mapping Logic

### STAC Layer → GeoJSON Layer Conversion

When `MapLayerStac` is mapped to `MapContextLayerGeojson` for MapContext:

```typescript
function mapStacToGeojson(stacLayer: MapLayerStac): MapContextLayerGeojson {
  return {
    type: 'geojson',
    id: stacLayer.id,
    label: stacLayer.label,
    visibility: stacLayer.visibility,
    version: stacLayer.version,
    data: {
      type: 'FeatureCollection',
      features: stacLayer.items,
    },
    style: {
      'fill-color': 'rgba(255, 0, 0, 0.1)',
      'stroke-color': '#ff0000',
      'stroke-width': 2,
    },
  }
}
```

**Mapping Rules**:

- `type` → `'geojson'` (always)
- `id`, `label`, `visibility`, `version` → copied directly
- `items` → wrapped in GeoJSON FeatureCollection as `data`
- Default styling applied (red outline, transparent fill)
- Filter state and pagination NOT exposed to MapContext
- Loading/error state NOT exposed to MapContext

## Data Flow

### Adding a STAC Layer

```
User provides {type: 'stac', url: '...'}
  ↓
Store creates MapLayerStac with defaults
  ↓
Initialize StacEndpoint
  ↓
Fetch collection metadata (optional)
  ↓
Fetch initial items (page 1, no filters)
  ↓
Update layer.items with GeoJSON features
  ↓
Computed context maps STAC → GeoJSON
  ↓
geospatial-sdk renders geometries on map
```

### Applying Filters

```
User changes date range or spatial checkbox
  ↓
Component updates layer.filters
  ↓
Watcher triggers refetchStacLayerItems()
  ↓
Set layer.loading = true
  ↓
Reset pagination to page 1
  ↓
Fetch items with new filters
  ↓
Update layer.items and pagination
  ↓
Set layer.loading = false
  ↓
Computed context updates
  ↓
Map re-renders with new geometries
```

### Pagination

```
User clicks "Next" button
  ↓
Store fetches from layer.pagination.nextLink
  ↓
Set layer.loading = true
  ↓
Fetch using link URL (includes all params)
  ↓
Update layer.items, pagination links, currentPage
  ↓
Set layer.loading = false
  ↓
Map updates with new page of items
```

## Persistence

**Current Scope**: No persistence

**Future Considerations**:

- Serialize `MapLayerStac` to JSON for localStorage
- Exclude `items` (too large) and `endpoint` (not serializable)
- Restore filters and pagination state on app reload
- Re-fetch items after restoration

## Performance Considerations

### Memory

- Each STAC layer stores up to `itemsPerPage` features (typically 50)
- GeoJSON features include geometry + properties
- Estimate: ~1-5KB per feature → 50-250KB per layer
- Multiple STAC layers = linear memory growth
- **Mitigation**: Limit items per page, clear items when layer hidden

### Network

- Initial load: 1 request (collection metadata) + 1 request (items)
- Filter change: 1 request (new items)
- Pagination: 1 request per page
- Map extent change (spatial filter enabled): Debounced to 500ms
- **Mitigation**: Debouncing, request cancellation, pagination

### Rendering

- OpenLayers renders GeoJSON geometries efficiently
- 50 geometries = minimal rendering cost
- Geometry complexity (polygons with many vertices) may impact performance
- **Mitigation**: Pagination limits geometry count, spatial filter reduces extent

## Validation Summary

### Layer Creation

- ✅ Type must be 'stac'
- ✅ URL must be valid HTTP(S)
- ✅ Collection ID must be non-empty
- ✅ Label must be non-empty

### Filter Application

- ✅ Date range: start ≤ end
- ✅ Spatial bbox: valid coordinate ranges
- ✅ Spatial bbox: west < east, south < north

### Pagination

- ✅ Current page ≥ 1
- ✅ Items per page > 0
- ✅ Links are valid URLs or null

### Item Validation

- ✅ Items must be valid GeoJSON Features
- ✅ Each item must have geometry property
- ✅ Geometry must be valid GeoJSON geometry type

## Error Handling

### Network Errors

- Store in `layer.error` property
- Display in UI using NuxtUI Alert
- Preserve previous items (don't clear on error)

### Invalid Responses

- Validate response structure
- Fallback to empty array if features missing
- Log warning to console

### Missing Geometries

- Skip items without geometry
- Log warning with item ID
- Continue processing remaining items

## Type Definitions Location

All TypeScript type definitions will be located in:

- `src/types/stac-layer.types.ts` - MapLayerStac and related types
- `src/types/stac-filter.types.ts` - Filter and pagination types

These will be referenced in the contracts/ directory of this spec.
