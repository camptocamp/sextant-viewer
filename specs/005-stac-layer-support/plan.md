# Implementation Plan: STAC Layer Support with Filtering and Pagination

**Branch**: `005-stac-layer-support` | **Date**: 2026-01-14 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from [/specs/005-stac-layer-support/spec.md](spec.md)

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add support for STAC (SpatioTemporal Asset Catalog) layers to the map viewer. Users can add STAC collections via URL, view collection items as geometries on the map, filter items by date range and spatial extent, and paginate through results. The implementation will extend the existing MapContext architecture by introducing a `MapLayerStac` type that gets mapped to `MapContextLayerGeojson` for rendering, using @camptocamp/ogc-client's `StacEndpoint` for API interactions.

## Technical Context

**Language/Version**: TypeScript 5.x / Vue 3 (Composition API)  
**Primary Dependencies**:

- @geospatial-sdk/core (^0.0.5-dev.44) - MapContext types and utilities
- @geospatial-sdk/openlayers (^0.0.5-dev.44) - Map rendering
- @camptocamp/ogc-client (^1.3.1-dev.53a6449) - STAC API integration
- @nuxt/ui (^4.3.0) - UI components (date inputs, checkboxes, pagination)
- Pinia (^3.0.4) - State management
- OpenLayers (^10.7.0) - Underlying map library

**Storage**: In-memory state (Pinia stores) - no persistence required  
**Testing**: Vitest (unit), Playwright (e2e)  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari)  
**Project Type**: Single-page web application (Vue 3 + Vite)  
**Performance Goals**:

- STAC collection metadata load: <3s
- Filter application response: <2s
- Pagination navigation: <1s
- Support up to 10,000 items without degradation

**Constraints**:

- STAC API must support CORS
- Items must have valid GeoJSON geometries
- Date range filter requires ISO 8601 datetime property
- Spatial filter requires STAC API bbox parameter support
- Loading indicators for operations >200ms

**Scale/Scope**:

- Single feature addition to existing map viewer
- ~5-8 new Vue components
- 2-3 new Pinia store actions
- 1 new composable for STAC operations
- Estimated 800-1200 LOC

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. MapContext as Source of Truth ✅ PASS

- **Requirement**: Use geospatial-sdk MapContext as single source of truth
- **Compliance**: STAC layers will extend MapContext architecture. A new `MapLayerStac` type will store STAC-specific metadata (filters, pagination), but will be mapped to `MapContextLayerGeojson` for actual rendering via computed property
- **Implementation Pattern**:
  - Internal store uses `MapLayer` (union of `MapContextLayer | MapLayerStac`)
  - Computed `context` property maps `MapLayerStac` → `MapContextLayerGeojson`
  - MapContext flows to geospatial-sdk with standard layer types only

### II. Vue.js Best Practices ✅ PASS

- **Requirement**: Vue 3 Composition API, `<script setup>`, Pinia with setup function
- **Compliance**: All new components will use `<script setup>`, STAC filter state managed via Pinia store methods, reactive refs and computed properties for UI state

### III. Clean Code & SOLID Principles ✅ PASS

- **Requirement**: Functions ≤20 lines, single responsibility, no premature abstraction
- **Compliance**: STAC operations will be decomposed into focused composables:
  - `useStacEndpoint()` - manage ogc-client endpoint lifecycle
  - `useStacFilters()` - handle date/spatial filter state
  - `useStacPagination()` - manage pagination state and navigation
  - Each handles one concern, ~10-15 lines per function

### IV. Component Architecture ✅ PASS

- **Requirement**: Atomic components, feature-based organization, ≤200 lines per component
- **Compliance**: New components will follow atomic structure:
  - **Atoms**: `StacDateInput`, `StacSpatialFilterCheckbox`, `StacPaginationControls`
  - **Molecules**: `StacFilterPanel`, `StacLayerControls`
  - **Organisms**: `StacLayerManager` (wraps filter panel + layer list)
  - All components ≤150 lines with clear separation of concerns

### V. TypeScript-First Development ✅ PASS

- **Requirement**: Strict TypeScript, explicit types, no unjustified `any`
- **Compliance**:
  - All STAC types will be properly defined: `MapLayerStac`, `StacFilter`, `StacPaginationState`
  - Import types from @camptocamp/ogc-client for STAC API structures
  - Use type guards for runtime validation of STAC API responses

### VI. Geospatial-SDK Integration ✅ PASS

- **Requirement**: Leverage geospatial-sdk utilities before custom solutions
- **Compliance**:
  - `MapLayerStac` will be mapped to `MapContextLayerGeojson` (standard geospatial-sdk type)
  - Use `addLayerToContext()` / `removeLayerFromContext()` for layer management
  - Final MapContext will contain only standard layer types (geojson)

### VII. Software Craftsmanship ✅ PASS

- **Requirement**: ESLint + Prettier, code review compliance, technical debt tracking
- **Compliance**: Existing linting/formatting infrastructure in place, plan will document any technical debt with TODO comments and context

### VIII. NuxtUI Component Library Standard ✅ PASS

- **Requirement**: Use NuxtUI components exclusively for UI elements
- **Compliance**:
  - Date inputs: `<UInput type="date">` or `<UInputDate>` (available in NuxtUI 4.3+)
  - Checkboxes: `<UCheckbox>` for spatial filter toggle
  - Buttons: `<UButton>` for pagination next/previous
  - Loading states: `<USkeleton>` or `<UProgress>`
  - Error messages: `<UAlert>` or `toast.add()`
  - Form groups: `<UFieldGroup>` for filter controls
  - No custom UI components needed

### IX. Minimal Comments Standard ✅ PASS

- **Requirement**: Self-documenting code, comments explain "why" not "what", no task/story references
- **Compliance**: Code will use clear naming (e.g., `computeFilteredStacItems()`, `MapLayerStac`), comments only for non-obvious business logic like "Map to GeoJSON for MapContext compatibility"

### X. OGC-Client Integration Standard ✅ PASS

- **Requirement**: Use @camptocamp/ogc-client for STAC, query capabilities, handle errors gracefully
- **Compliance**:
  - Use `StacEndpoint` from ogc-client (no `.isReady()` needed for STAC)
  - Query collections via `allCollections` and `getCollection()`
  - Search items via `getCollectionItemsResponse()` with bbox/datetime filters
  - Handle CORS/network errors with NuxtUI toast notifications
  - Visualize items as GeoJSON footprints (standard STAC pattern)

### Gate Status: ✅ **ALL GATES PASSED**

No constitution violations. Feature aligns with all architectural principles.

## Project Structure

### Documentation (this feature)

```text
specs/005-stac-layer-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── stac-layer.ts         # MapLayerStac type definition
│   ├── stac-filter.ts        # Filter state interfaces
│   └── stac-pagination.ts    # Pagination state interfaces
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── layer-manager/
│   │   ├── LayerManager.vue          # [EXISTING] - extend for STAC layers
│   │   └── LayerDetailsPanel.vue     # [EXISTING] - extend for STAC details
│   └── stac/                          # [NEW] STAC-specific components
│       ├── StacFilterPanel.vue            # Date + spatial filter controls
│       ├── StacPaginationControls.vue     # Next/prev buttons + count display
│       ├── StacLayerControls.vue          # STAC layer-specific controls
│       └── StacItemsIndicator.vue         # Loading/empty state display
│
├── composables/
│   ├── useLayerActions.ts            # [EXISTING] - extend for STAC layers
│   ├── useLayerReordering.ts         # [EXISTING] - no changes needed
│   └── useStacOperations.ts          # [NEW] STAC API interactions
│
├── stores/
│   ├── map.store.ts                  # [MODIFY] Add MapLayerStac support
│   └── layers.store.ts               # [EXISTING] - may need minor updates
│
├── utils/
│   ├── map-config.ts                 # [EXISTING] - no changes
│   ├── layer.utils.ts                # [EXISTING] - extend for STAC type guards
│   └── stac.utils.ts                 # [NEW] STAC-specific utilities
│
└── types/
    ├── stac-layer.types.ts           # [NEW] MapLayerStac and related types
    └── stac-filter.types.ts          # [NEW] Filter and pagination types

tests/
└── unit/
    └── stores/
        └── map.store.spec.ts         # [NEW] Tests for STAC layer mapping
```

**Structure Decision**: Single web application structure (Option 1). All STAC-related code will be organized under feature-based directories (`components/stac/`, `utils/stac.utils.ts`) to maintain clear separation while integrating with existing layer management infrastructure. The core integration point is `map.store.ts` which will be extended to support the new `MapLayerStac` type alongside existing `MapContextLayer` types.

## Complexity Tracking

No constitution violations requiring justification. All complexity is inherent to the feature requirements and follows established architectural patterns.

---

## Phase 0: Research (Complete)

**Output**: [research.md](research.md)

**Key Decisions**:

1. ✅ MapLayerStac type coexists with MapContextLayer via union type
2. ✅ Computed context property maps STAC → GeoJSON for MapContext compatibility
3. ✅ Use @camptocamp/ogc-client StacEndpoint for API interactions
4. ✅ Embed filter/pagination state directly in MapLayerStac
5. ✅ Vue watchers + debouncing for map extent changes
6. ✅ STAC API link-based pagination (hypermedia approach)

**Risks Identified & Mitigated**:

- CORS issues → Early detection with clear error messages
- Performance with large collections → Pagination + debouncing
- Malformed API responses → Type validation + fallbacks
- Map extent timing → Debouncing + explicit enable toggle

---

## Phase 1: Design (Complete)

### Outputs

1. ✅ **[data-model.md](data-model.md)** - Complete data structure definitions
2. ✅ **[contracts/](contracts/)** - TypeScript type definitions:
   - `stac-layer.ts` - MapLayerStac and related types
   - `stac-api.ts` - STAC API interaction types and helpers
   - `map-store-extension.ts` - Store interface extensions
3. ✅ **[quickstart.md](quickstart.md)** - Step-by-step implementation guide

### Data Model Summary

**Core Types**:

- `MapLayerStac` - STAC layer with embedded filters, pagination, items
- `StacFilters` - Date range + spatial extent filters
- `StacPagination` - Page navigation with STAC API links
- `MapLayer` - Union type: `MapContextLayer | MapLayerStac`

**Key Relationships**:

- MapStore → internal `MapLayer[]` → computed `MapContext`
- MapLayerStac → mapped to MapContextLayerGeojson for rendering
- StacEndpoint (@camptocamp/ogc-client) → fetch items with filters

### Integration Points

**Store Extensions**:

- `addLayer()` - accepts MapLayer (includes STAC)
- `refetchStacLayerItems()` - fetch items with current filters
- `goToNextStacPage()` / `goToPrevStacPage()` - pagination navigation
- Computed `context` - maps STAC to GeoJSON

**UI Components**:

- `StacFilterPanel` - Date inputs + spatial checkbox (NuxtUI)
- `StacPaginationControls` - Next/prev buttons + count display
- `LayerDetailsPanel` - Extended to show STAC-specific controls

**Composable**:

- `useStacOperations()` - Wraps StacEndpoint, handles fetching and errors

---

## Next Steps

### Phase 2: Task Generation

Run `/speckit.tasks` to generate implementation tasks organized by user story:

**Expected Task Organization**:

- **Setup Phase**: Type definitions, store structure
- **Foundational Phase**: STAC API integration, store actions
- **User Story 1 (P1)**: Add & display STAC layer
- **User Story 2 (P2)**: Date range filtering
- **User Story 3 (P2)**: Spatial extent filtering
- **User Story 4 (P2)**: Pagination
- **User Story 5 (P3)**: Combined filtering
- **Polish Phase**: Error handling, loading states, documentation

### Implementation Order

1. **MVP (User Story 1)**: Basic STAC layer support
   - Add MapLayerStac type
   - Extend map.store with computed context
   - Create useStacOperations composable
   - Fetch and display items (no filters)
   - **Deliverable**: View STAC collection items on map

2. **Filtering (User Stories 2-3)**: Add filter capabilities
   - Date range inputs
   - Spatial extent checkbox
   - Watcher-based refetching
   - **Deliverable**: Filter STAC items by date and/or spatial extent

3. **Pagination (User Story 4)**: Navigate through results
   - Pagination controls
   - Link-based navigation
   - Page count display
   - **Deliverable**: Browse large STAC collections

4. **Polish (User Story 5 + extras)**: Combined filters + UX improvements
   - Verify combined filtering works
   - Error handling with toasts
   - Loading indicators
   - **Deliverable**: Production-ready STAC layer support

### Success Metrics

Implementation complete when all acceptance scenarios pass:

- ✅ STAC layer appears in layer manager
- ✅ Items render as geometries on map
- ✅ Date filter updates items
- ✅ Spatial filter updates items
- ✅ Pagination navigates through pages
- ✅ Combined filters work together
- ✅ Loading states display correctly
- ✅ Errors display user-friendly messages

---

## Appendix: STAC Example

**Test Collection URL**:

```
https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr/collections/sentinel-2-radiometric-indices
```

**Manual Test Layer**:

```javascript
const mapStore = useMapStore()
mapStore.addLayer({
  type: 'stac',
  id: 'test-sentinel2',
  url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr',
  collectionId: 'sentinel-2-radiometric-indices',
  label: 'Sentinel-2 Radiometric Indices',
  visibility: true,
  version: 0,
  filters: {
    dateRange: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
    spatialExtent: { enabled: false, bbox: null },
  },
  pagination: {
    currentPage: 1,
    totalItems: null,
    itemsPerPage: 50,
    nextLink: null,
    prevLink: null,
  },
  items: [],
  loading: false,
  error: null,
})

// Trigger initial fetch
mapStore.refetchStacLayerItems('test-sentinel2')
```
