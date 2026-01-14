# Research: STAC Layer Support Implementation

**Feature**: 005-stac-layer-support  
**Date**: 2026-01-14  
**Status**: Complete

## Overview

This document captures research findings and architectural decisions for implementing STAC (SpatioTemporal Asset Catalog) layer support in the map viewer. The primary challenge is extending the MapContext architecture (which expects standard layer types) to support STAC layers with dynamic filtering and pagination, while maintaining compatibility with the geospatial-sdk.

## Key Research Questions

### 1. How to extend MapContext to support STAC layers while maintaining geospatial-sdk compatibility?

**Decision**: Introduce `MapLayerStac` type alongside `MapContextLayer`, use computed property for mapping

**Rationale**:

- MapContext from geospatial-sdk expects specific layer types (`wms`, `wmts`, `xyz`, `geojson`, etc.)
- STAC layers need additional metadata (filters, pagination state, endpoint reference) not supported by standard layer types
- STAC items are best visualized as GeoJSON geometries for footprint display

**Approach**:

```typescript
// Internal layer type (union)
type MapLayer = MapContextLayer | MapLayerStac

// Store maintains internal layers
const internalLayers = ref<MapLayer[]>([])

// Computed context maps STAC → GeoJSON
const context = computed<MapContext>(() => ({
  ...baseContext.value,
  layers: internalLayers.value.map((layer) =>
    isStacLayer(layer) ? mapStacToGeojson(layer) : layer,
  ),
}))
```

**Benefits**:

- Maintains MapContext compatibility for geospatial-sdk
- STAC-specific state stays in the store without polluting MapContext
- Clean separation of concerns: internal representation vs. external contract
- Enables reactive updates when filters change

**Alternatives Considered**:

- ❌ Store STAC metadata in `extras` property: `extras` is for static metadata, not reactive filter state
- ❌ Create parallel STAC store: Would duplicate layer management logic and complicate synchronization
- ❌ Extend MapContextLayer types: Would require forking geospatial-sdk or creating incompatible types

### 2. How to handle STAC API interactions and filter state management?

**Decision**: Use @camptocamp/ogc-client's `StacEndpoint` class with dedicated composable

**Rationale**:

- ogc-client provides STAC API client with proper typing and error handling
- Constitution Principle X mandates use of ogc-client for OGC services
- STAC API is already supported by ogc-client v1.3.1+

**Implementation Pattern**:

```typescript
// composables/useStacOperations.ts
export function useStacOperations() {
  const endpoint = ref<StacEndpoint | null>(null)

  async function initializeEndpoint(url: string) {
    endpoint.value = new StacEndpoint(url)
    // Note: STAC doesn't need .isReady() unlike WMS/WMTS
  }

  async function fetchItems(collectionId: string, filters: StacFilters) {
    if (!endpoint.value) throw new Error('Endpoint not initialized')

    return await endpoint.value.getCollectionItemsResponse(collectionId, {
      bbox: filters.spatialExtent,
      datetime: filters.dateRange,
      limit: filters.pageSize,
    })
  }

  return { initializeEndpoint, fetchItems }
}
```

**Alternatives Considered**:

- ❌ Direct fetch() calls: Would require manual pagination link parsing, error handling, and response validation
- ❌ Third-party STAC library: ogc-client is already a dependency and is mandated by constitution

### 3. How to handle filtering and pagination state?

**Decision**: Embed filter/pagination state directly in `MapLayerStac` type

**Rationale**:

- Each STAC layer has independent filter and pagination state
- State must persist when layer visibility is toggled
- State must be reactive to trigger re-fetching when changed
- Layer-scoped state is cleaner than global filter store

**Structure**:

```typescript
interface MapLayerStac {
  type: 'stac'
  id: string
  url: string
  collectionId: string
  label: string
  visibility: boolean
  version: number

  // STAC-specific state
  filters: {
    dateRange: {
      start: Date | null
      end: Date | null
    }
    spatialExtent: {
      enabled: boolean
      bbox: number[] | null // [west, south, east, north]
    }
  }

  pagination: {
    currentPage: number
    totalItems: number | null
    itemsPerPage: number
    nextLink: string | null
    prevLink: string | null
  }

  // Computed/cached data
  items: GeoJSON.Feature[]
  loading: boolean
  error: string | null
}
```

**Benefits**:

- Self-contained layer state
- Easy to serialize/persist
- Clear ownership of filter state
- Supports multiple independent STAC layers

**Alternatives Considered**:

- ❌ Global filter store: Would complicate multi-layer scenarios and layer-specific filters
- ❌ Separate filter objects: Would create coupling and synchronization issues
- ❌ URL-based state: Would lose state on page reload without additional persistence

### 4. How to trigger item refetching when filters or map extent changes?

**Decision**: Use Vue watchers in the component with debouncing for map extent changes

**Rationale**:

- Filters change infrequently (user interaction) - no debounce needed
- Map extent changes frequently (pan/zoom) - requires debouncing
- Component-level watchers provide clear lifecycle management
- Store actions handle the actual fetching logic

**Implementation Pattern**:

```typescript
// In StacFilterPanel.vue
watch(
  () => layer.filters.dateRange,
  async (newRange) => {
    await mapStore.refetchStacLayerItems(layer.id)
  },
  { deep: true },
)

watch(
  () => layer.filters.spatialExtent.enabled,
  async (enabled) => {
    if (enabled) {
      layer.filters.spatialExtent.bbox = getCurrentMapBounds()
    }
    await mapStore.refetchStacLayerItems(layer.id)
  },
)

// Debounced map extent watcher
const debouncedExtentUpdate = useDebounceFn(async () => {
  if (layer.filters.spatialExtent.enabled) {
    layer.filters.spatialExtent.bbox = getCurrentMapBounds()
    await mapStore.refetchStacLayerItems(layer.id)
  }
}, 500)

watch(() => mapStore.view.extent, debouncedExtentUpdate)
```

**Alternatives Considered**:

- ❌ Store-level watchers: Would require registering/unregistering watchers, complicates store logic
- ❌ Polling: Inefficient and would miss immediate user-triggered changes
- ❌ Manual refetch calls: Would scatter refetch logic across multiple components

### 5. How to handle pagination with STAC API link-based navigation?

**Decision**: Store next/prev links from STAC API response, use links for navigation

**Rationale**:

- STAC API uses hypermedia (HAL) links for pagination navigation
- Links include all necessary query parameters for the next/previous page
- Server controls pagination strategy (offset vs. cursor-based)

**Implementation**:

```typescript
async function fetchStacItems(layer: MapLayerStac, pageLink?: string) {
  const endpoint = new StacEndpoint(layer.url)

  let response
  if (pageLink) {
    // Use provided pagination link (includes all params)
    const res = await fetch(pageLink)
    response = await res.json()
  } else {
    // Initial fetch with filters
    response = await endpoint.getCollectionItemsResponse(layer.collectionId, {
      bbox: layer.filters.spatialExtent.bbox,
      datetime: {
        start: layer.filters.dateRange.start,
        end: layer.filters.dateRange.end,
      },
      limit: layer.pagination.itemsPerPage,
    })
  }

  // Extract pagination links
  const nextLink = response.links?.find((l) => l.rel === 'next')?.href
  const prevLink = response.links?.find((l) => l.rel === 'prev')?.href

  // Update layer state
  layer.items = response.features
  layer.pagination.totalItems = response.numberMatched
  layer.pagination.nextLink = nextLink
  layer.pagination.prevLink = prevLink
}
```

**Benefits**:

- Handles both offset and cursor-based pagination
- Server controls page size and navigation logic
- Simplifies client implementation

**Alternatives Considered**:

- ❌ Client-side page calculation: Would break with cursor-based pagination
- ❌ Manual query string construction: Error-prone and duplicates server logic

## Technology Decisions

### STAC API Client

**Choice**: @camptocamp/ogc-client `StacEndpoint`  
**Version**: ^1.3.1-dev.53a6449 (already installed)

**Justification**:

- Already a project dependency
- Mandated by Constitution Principle X
- Provides TypeScript types for STAC responses
- Handles CORS detection and error cases
- Maintained by Camptocamp (same org as geospatial-sdk)

### UI Components

**Choice**: NuxtUI components  
**Components needed**:

- `<UInputDate>` or `<UInput type="date">` - Date range inputs
- `<UCheckbox>` - Spatial filter toggle
- `<UButton>` - Pagination controls
- `<UFieldGroup>` - Filter form layout
- `<USkeleton>` or `<UProgress>` - Loading states
- `<UAlert>` or `useToast()` - Error messages
- `<UBadge>` - Item count display

**Justification**:

- Mandated by Constitution Principle VIII
- All required components available in NuxtUI 4.3+
- Consistent with existing application UI
- No custom UI components needed

### Date Handling

**Choice**: Native JavaScript `Date` objects with ISO 8601 formatting

**Justification**:

- STAC API expects ISO 8601 format (e.g., `"2023-01-01T00:00:00Z"`)
- No need for heavy date library (moment.js, date-fns)
- Native Date with `.toISOString()` sufficient for STAC API
- NuxtUI date inputs work with native Date objects

**Implementation**:

```typescript
function formatDateForStac(date: Date | null): string | null {
  return date ? date.toISOString() : null
}

function parseDateRange(start: Date | null, end: Date | null) {
  if (!start && !end) return undefined

  return {
    start: start || undefined,
    end: end || undefined,
  }
}
```

### Debouncing

**Choice**: VueUse `useDebounceFn()` composable

**Justification**:

- Already available through @vueuse/core (common Vue ecosystem package)
- Integrated with Vue's reactivity system
- Handles cleanup on component unmount
- Standard solution for this pattern in Vue applications

**Installation**: Add `@vueuse/core` to dependencies

## Implementation Strategy

### Phase 1: Core Type System & Store Extension

1. Define `MapLayerStac` type with all required properties
2. Create type guard functions (`isStacLayer()`)
3. Extend `map.store.ts` to accept `MapLayer` union type
4. Implement `computedContext` that maps STAC → GeoJSON
5. Add store action `refetchStacLayerItems()`

### Phase 2: STAC API Integration

1. Create `useStacOperations()` composable
2. Implement collection metadata fetching
3. Implement item fetching with filter support
4. Add pagination link handling
5. Add error handling and loading states

### Phase 3: UI Components

1. Create `StacFilterPanel.vue` (date + spatial filters)
2. Create `StacPaginationControls.vue` (next/prev + count)
3. Extend `LayerDetailsPanel.vue` for STAC layer type
4. Add loading/empty state indicators

### Phase 4: Integration

1. Wire filter changes to refetch actions
2. Implement map extent watching for spatial filter
3. Add debouncing for extent changes
4. Integrate STAC layers into LayerManager UI
5. Add error handling and user feedback

## Risk Mitigation

### Risk: STAC API CORS issues

**Mitigation**:

- Detect CORS errors early with try/catch
- Display clear error message to user
- Document CORS requirements in feature documentation
- Consider server-side proxy for CORS bypass (future enhancement)

### Risk: Performance with large item collections

**Mitigation**:

- Use pagination (default 50 items per page)
- Debounce map extent changes (500ms)
- Cancel pending requests when new filters applied
- Display loading indicators for user feedback

### Risk: Missing or malformed STAC API responses

**Mitigation**:

- Validate response structure with TypeScript types
- Handle missing pagination links gracefully
- Provide fallback values (e.g., "unknown" for total count)
- Log errors to console for debugging

### Risk: Map extent calculation timing issues

**Mitigation**:

- Only activate extent filter when explicitly enabled
- Debounce extent changes to avoid rapid refetching
- Cache current extent value to detect actual changes
- Use AbortController for request cancellation

## Open Questions

None. All architectural decisions have been made with sufficient information from:

- Existing codebase structure (map.store.ts, layer components)
- ogc-client documentation (STAC API support)
- geospatial-sdk documentation (MapContext types)
- NuxtUI documentation (available components)
- Constitution principles (architectural constraints)

## References

- [STAC Specification](https://stacspec.org/)
- [STAC API Specification](https://github.com/radiantearth/stac-api-spec)
- [@camptocamp/ogc-client Documentation](https://github.com/camptocamp/ogc-client)
- [geospatial-sdk Documentation](https://github.com/camptocamp/geospatial-sdk)
- [NuxtUI Components](https://ui.nuxt.com/docs/components)
- [Constitution - OGC-Client Integration](../../.specify/memory/constitution.md#x-ogc-client-integration-standard)
