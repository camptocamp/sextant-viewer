# Tasks: STAC Layer Support with Filtering and Pagination

**Branch**: `005-stac-layer-support`  
**Input**: Design documents from `/specs/005-stac-layer-support/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested in specification - focusing on implementation tasks only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create foundational types

- [ ] T001 Install @vueuse/core dependency for debouncing (npm install @vueuse/core)
- [ ] T002 [P] Create src/types/stac-layer.types.ts with MapLayerStac and related interfaces from contracts/stac-layer.ts
- [ ] T003 [P] Create src/types/stac-api.types.ts with STAC API types and helpers from contracts/stac-api.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core store extensions that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Extend src/utils/layer.utils.ts with MapLayer union type and isStacLayer() type guard
- [ ] T005 Modify src/stores/map.store.ts to use internal MapLayer array instead of direct MapContextLayer
- [ ] T006 Add computed context property to src/stores/map.store.ts that maps STAC layers to GeoJSON
- [ ] T007 Implement mapStacToGeojson() helper function in src/stores/map.store.ts
- [ ] T008 Create src/composables/useStacOperations.ts with StacEndpoint integration
- [ ] T009 Add refetchStacLayerItems() action to src/stores/map.store.ts
- [ ] T010 Add goToNextStacPage() and goToPrevStacPage() actions to src/stores/map.store.ts

**Checkpoint**: Foundation ready - STAC layers can be added and fetched, user story UI can now be built

---

## Phase 3: User Story 1 - Add and Display STAC Layer (Priority: P1) 🎯 MVP

**Goal**: Users can add STAC collections and view item geometries on the map

**Independent Test**: Add STAC layer via console, verify items appear in layer manager and geometries render on map

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create src/components/stac/StacItemsIndicator.vue for loading/empty/error states
- [ ] T012 [US1] Extend src/components/layer-manager/LayerManager.vue to display STAC layers in the list
- [ ] T013 [US1] Extend src/components/layer-manager/LayerDetailsPanel.vue to detect and show STAC layer type
- [ ] T014 [US1] Add conditional rendering in LayerDetailsPanel.vue to show StacItemsIndicator for STAC layers
- [ ] T015 [US1] Add error handling with NuxtUI toast notifications in map.store.ts refetchStacLayerItems()
- [ ] T016 [US1] Test adding STAC layer via console and verify items load and display on map

**Checkpoint**: ✅ STAC layers can be added, appear in layer manager, and display geometries on map

---

## Phase 4: User Story 2 - Filter by Date Range (Priority: P2)

**Goal**: Users can filter STAC items by selecting start and end dates

**Independent Test**: Add STAC layer, set date range, verify only items within range are displayed

### Implementation for User Story 2

- [ ] T017 [P] [US2] Create src/components/stac/StacDateRangeFilter.vue with two UInput date fields
- [ ] T018 [P] [US2] Add date range watcher in StacDateRangeFilter.vue that triggers refetchStacLayerItems()
- [ ] T019 [US2] Create src/components/stac/StacFilterPanel.vue wrapper component
- [ ] T020 [US2] Add StacDateRangeFilter to StacFilterPanel component
- [ ] T021 [US2] Update LayerDetailsPanel.vue to show StacFilterPanel for STAC layers
- [ ] T022 [US2] Test date range filtering with various date combinations (start only, end only, both, neither)

**Checkpoint**: ✅ Date range filtering works independently and updates map display

---

## Phase 5: User Story 3 - Filter by Spatial Extent (Priority: P2)

**Goal**: Users can filter STAC items to only those within the current map extent

**Independent Test**: Add STAC layer, enable spatial filter checkbox, pan/zoom map, verify items update to match extent

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create src/components/stac/StacSpatialFilter.vue with UCheckbox for extent toggle
- [ ] T024 [US3] Add spatial filter enabled watcher in StacSpatialFilter.vue that captures map bounds and triggers refetch
- [ ] T025 [US3] Add map view.extent watcher in StacSpatialFilter.vue with useDebounceFn() (500ms debounce)
- [ ] T026 [US3] Implement getMapBounds() helper to extract bbox from map view extent
- [ ] T027 [US3] Add StacSpatialFilter to StacFilterPanel component
- [ ] T028 [US3] Test spatial filtering with checkbox toggle and map pan/zoom interactions

**Checkpoint**: ✅ Spatial extent filtering works independently and updates after map movements

---

## Phase 6: User Story 4 - Paginate Through Results (Priority: P2)

**Goal**: Users can navigate through paginated STAC results with next/previous buttons

**Independent Test**: Add STAC layer with many items, verify pagination controls appear and function correctly

### Implementation for User Story 4

- [ ] T029 [P] [US4] Create src/components/stac/StacPaginationControls.vue with prev/next UButton components
- [ ] T030 [US4] Add computed properties in StacPaginationControls.vue for hasNextPage, hasPrevPage, countText
- [ ] T031 [US4] Wire prev/next buttons to mapStore.goToPrevStacPage() and goToNextStacPage() actions
- [ ] T032 [US4] Add pagination controls to LayerDetailsPanel.vue below filter panel for STAC layers
- [ ] T033 [US4] Implement disabled state logic for buttons (first/last page, loading state)
- [ ] T034 [US4] Test pagination navigation with various page positions (first, middle, last)

**Checkpoint**: ✅ Pagination works independently and displays accurate page/count information

---

## Phase 7: User Story 5 - Combined Filtering (Priority: P3)

**Goal**: Users can apply both date range and spatial extent filters simultaneously

**Independent Test**: Add STAC layer, enable both date and spatial filters, verify results match both criteria

### Implementation for User Story 5

- [ ] T035 [US5] Test combined filter scenario: date range + spatial extent both active
- [ ] T036 [US5] Verify buildStacRequestParams() in stac-api.types.ts correctly combines both filter types
- [ ] T037 [US5] Test pagination with combined filters active
- [ ] T038 [US5] Verify filter changes reset pagination to page 1

**Checkpoint**: ✅ Combined filtering works correctly and integrates with pagination

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, loading states, and user experience improvements

- [ ] T039 [P] Add USkeleton loading state to StacFilterPanel while items are loading
- [ ] T040 [P] Add UAlert error display to StacFilterPanel when fetch fails
- [ ] T041 [P] Implement request cancellation using AbortController for rapid filter changes
- [ ] T042 [P] Add clear/reset filters button to StacFilterPanel
- [ ] T043 Verify layer visibility toggle works correctly for STAC layers
- [ ] T044 Test multiple STAC layers coexisting without interference
- [ ] T045 Verify STAC layers don't affect existing layer types (WMS, XYZ, etc.)
- [ ] T046 Add comprehensive error messages for common failure scenarios (CORS, network, invalid response)

**Checkpoint**: ✅ Production-ready STAC layer support with polished UX

---

## Dependencies Between User Stories

### Independent Stories (Can be implemented in parallel)

- **US2 (Date Range)** and **US3 (Spatial Extent)** are independent
- **US4 (Pagination)** is independent of US2 and US3

### Sequential Dependencies

- **US1 → US2, US3, US4**: Core layer support must exist before filters/pagination
- **US5** depends on US2 and US3 (combined filtering)

### Suggested Order for MVP Delivery

1. **Phase 1-2 (Foundation)**: T001-T010 - Complete first
2. **US1 (P1 - MVP)**: T011-T016 - Deliverable: View STAC items on map
3. **US2 (P2)**: T017-T022 - Deliverable: Date filtering
4. **US3 (P2)**: T023-T028 - Deliverable: Spatial filtering
5. **US4 (P2)**: T029-T034 - Deliverable: Pagination
6. **US5 (P3)**: T035-T038 - Deliverable: Combined filters
7. **Polish**: T039-T046 - Production readiness

---

## Parallel Execution Opportunities

### During US2 (Date Range Filtering)

Can work on in parallel:

- T017 (date filter component)
- T018 (watcher logic)

### During US3 (Spatial Extent Filtering)

Can work on in parallel:

- T023 (spatial filter component)
- T024 (enabled watcher)
- T025 (debounced extent watcher)

### During US4 (Pagination)

Can work on in parallel:

- T029 (pagination component)
- T030 (computed properties)

### During Polish Phase

Can work on in parallel:

- T039 (loading skeleton)
- T040 (error alert)
- T041 (request cancellation)
- T042 (clear filters button)
- T046 (error messages)

---

## Implementation Strategy

### MVP First (Minimum Viable Product)

**Complete**: Phase 1-2 + US1 (T001-T016)  
**Deliverable**: Basic STAC layer support - view collection items on map  
**Time Estimate**: 3-4 hours  
**Value**: Users can visualize STAC collections immediately

### Incremental Feature Delivery

- **Add Date Filter**: US2 (T017-T022) - 1-2 hours
- **Add Spatial Filter**: US3 (T023-T028) - 1-2 hours
- **Add Pagination**: US4 (T029-T034) - 1-2 hours
- **Test Combined**: US5 (T035-T038) - 30 min
- **Polish UX**: Phase 8 (T039-T046) - 1-2 hours

**Total Estimate**: 8-12 hours for complete feature

---

## Task Validation

### Format Compliance

✅ All tasks follow format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
✅ Sequential task IDs (T001-T046)
✅ [P] marker for parallelizable tasks
✅ [US#] marker for user story tasks
✅ Specific file paths in descriptions

### Coverage Verification

✅ All 5 user stories have dedicated tasks
✅ Each story has independent test criteria
✅ Foundation phase blocks all user stories (correct dependency)
✅ Parallel opportunities identified per story
✅ MVP scope clearly defined (US1)

### Task Completeness

✅ 46 tasks total
✅ Setup: 3 tasks
✅ Foundation: 7 tasks
✅ US1 (P1): 6 tasks
✅ US2 (P2): 6 tasks
✅ US3 (P2): 6 tasks
✅ US4 (P2): 6 tasks
✅ US5 (P3): 4 tasks
✅ Polish: 8 tasks

---

## Success Criteria (from spec.md)

Implementation complete when:

- ✅ **SC-001**: Users can add STAC layer and see items within 3 seconds (US1)
- ✅ **SC-002**: Date range filters apply within 2 seconds (US2)
- ✅ **SC-003**: Spatial extent filtering updates within 2 seconds (US3)
- ✅ **SC-004**: Pagination navigation completes within 1 second (US4)
- ✅ **SC-005**: Page number and count display accurately (US4)
- ✅ **SC-006**: Loading indicators show for operations >200ms (Polish)
- ✅ **SC-007**: Handle 10,000+ items without degradation (US4)
- ✅ **SC-008**: Error messages display within 5 seconds (Polish)
- ✅ **SC-009**: Combined filters work correctly (US5)
- ✅ **SC-010**: Race conditions prevented via request cancellation (Polish)

---

## Quick Reference

### File Structure

```
src/
├── components/stac/
│   ├── StacFilterPanel.vue           # T019 - Wrapper for all filters
│   ├── StacDateRangeFilter.vue       # T017 - Date inputs
│   ├── StacSpatialFilter.vue         # T023 - Spatial checkbox
│   ├── StacPaginationControls.vue    # T029 - Next/prev buttons
│   └── StacItemsIndicator.vue        # T011 - Loading/error states
├── composables/
│   └── useStacOperations.ts          # T008 - STAC API wrapper
├── stores/
│   └── map.store.ts                  # T005-T010 - Store extensions
├── types/
│   ├── stac-layer.types.ts           # T002 - MapLayerStac types
│   └── stac-api.types.ts             # T003 - API types
└── utils/
    └── layer.utils.ts                # T004 - Type guards
```

### Testing Commands

```bash
# Manual test - add STAC layer via console
mapStore.addLayer({
  type: 'stac',
  id: 'test-stac',
  url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr',
  collectionId: 'sentinel-2-radiometric-indices',
  label: 'Test STAC',
  visibility: true,
  version: 0,
  filters: { dateRange: { start: null, end: null }, spatialExtent: { enabled: false, bbox: null } },
  pagination: { currentPage: 1, totalItems: null, itemsPerPage: 50, nextLink: null, prevLink: null },
  items: [],
  loading: false,
  error: null
})

mapStore.refetchStacLayerItems('test-stac')
```

### Key Watchpoints During Implementation

1. Ensure computed context maintains MapContext type (no STAC layers leak through)
2. Test that STAC → GeoJSON mapping preserves layer.id for updates/deletions
3. Verify debouncing prevents API spam during rapid map movements
4. Confirm request cancellation works when filters change rapidly
5. Test layer visibility toggle with STAC layers
6. Verify multiple STAC layers don't interfere with each other
