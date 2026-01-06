# Tasks: Map Application Bootstrap

**Input**: Design documents from `/specs/001-map-bootstrap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Tests are NOT requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single frontend SPA**: `src/` at repository root
- All paths are relative to `/home/fgravin/dev/sextant/viewer`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and verify project initialization

- [X] T001 Install geospatial-sdk packages: npm install @geospatial-sdk/core @geospatial-sdk/openlayers ol
- [X] T002 Verify existing Vue.js project structure matches plan.md requirements
- [X] T003 [P] Verify TypeScript strict mode enabled in tsconfig.json
- [X] T004 [P] Verify Tailwind CSS configured in vite.config.ts and tailwind.config.js

**Checkpoint**: Dependencies installed, project configuration verified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration and utilities that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Update src/assets/main.css to import OpenLayers CSS and add full viewport layout styles
- [X] T006 Create src/utils/map-config.ts with DEFAULT_MAP_CONTEXT constant (OSM basemap, world view)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Full-Screen Base Map (Priority: P1) 🎯 MVP

**Goal**: User can open the application and immediately see a full-screen map with OpenStreetMap base layer that responds to pan/zoom interactions

**Independent Test**:
1. Run `npm run dev`
2. Open http://localhost:5173
3. Verify full-screen map displays with OSM tiles
4. Verify pan (drag) works smoothly
5. Verify zoom (scroll wheel) works smoothly
6. Resize browser window and verify map fills entire viewport

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create src/stores/map.store.ts with Pinia store structure (MapContext state, mapInstance ref)
- [ ] T008 [P] [US1] Create src/components/map/MapViewer.vue component file structure
- [ ] T009 [US1] Implement MapContext initialization in src/stores/map.store.ts using DEFAULT_MAP_CONTEXT
- [ ] T010 [US1] Implement computed getters (layers, view) in src/stores/map.store.ts
- [ ] T011 [US1] Implement setMapInstance action in src/stores/map.store.ts
- [ ] T012 [US1] Implement MapViewer template with full-screen container in src/components/map/MapViewer.vue
- [ ] T013 [US1] Implement onMounted lifecycle hook to create map from context in src/components/map/MapViewer.vue
- [ ] T014 [US1] Implement map cleanup in onBeforeUnmount hook in src/components/map/MapViewer.vue
- [ ] T015 [US1] Add bidirectional sync watcher for context changes in src/components/map/MapViewer.vue
- [ ] T016 [US1] Add map moveend event handler with isUpdatingFromMap flag in src/components/map/MapViewer.vue
- [ ] T017 [US1] Implement setView action in src/stores/map.store.ts for view updates
- [ ] T018 [US1] Create src/views/MapView.vue wrapper component for MapViewer
- [ ] T019 [US1] Update src/router/index.ts to replace routes with single '/' route to MapView
- [ ] T020 [US1] Update src/App.vue to minimal RouterView wrapper (remove centering, navigation)
- [ ] T021 [US1] Run dev server and verify full-screen map renders with OSM basemap
- [ ] T022 [US1] Verify pan interactions update map view smoothly (60 fps)
- [ ] T023 [US1] Verify zoom interactions update map view smoothly (60 fps)
- [ ] T024 [US1] Verify browser resize adjusts map to fill viewport automatically

**Checkpoint**: User Story 1 complete - Full-screen map with OSM basemap fully functional and independently testable

---

## Phase 4: User Story 2 - Developer Can Manage Map State (Priority: P2)

**Goal**: Developers can programmatically manipulate map state through Pinia store actions (addLayer, removeLayer, updateLayer) with changes reflected on the map

**Independent Test**:
1. Open browser console
2. Execute: `const mapStore = useMapStore()`
3. Test addLayer: `mapStore.addLayer({ type: 'xyz', id: 'test', url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png', visible: true, opacity: 0.5 })`
4. Verify layer appears on map
5. Test removeLayer: `mapStore.removeLayer('test')`
6. Verify layer disappears
7. Test updateLayer: `mapStore.updateLayer('basemap-osm', { opacity: 0.7 })`
8. Verify basemap opacity changes

### Implementation for User Story 2

- [ ] T025 [US2] Create helper function getLayerId in src/stores/map.store.ts for handling MapContextLayer union types
- [ ] T026 [US2] Create helper function isLayerVisible in src/stores/map.store.ts for handling MapContextLayer union types
- [ ] T027 [US2] Implement addLayer action with immutable update pattern in src/stores/map.store.ts
- [ ] T028 [US2] Implement removeLayer action with immutable update pattern in src/stores/map.store.ts
- [ ] T029 [US2] Implement updateLayer action with immutable update pattern and type assertions in src/stores/map.store.ts
- [ ] T030 [US2] Add visibleLayers computed getter in src/stores/map.store.ts
- [ ] T031 [US2] Verify addLayer creates new layer in MapContext and map reflects change within 100ms
- [ ] T032 [US2] Verify removeLayer removes layer from MapContext and map reflects change within 100ms
- [ ] T033 [US2] Verify updateLayer modifies layer properties and map reflects change within 100ms
- [ ] T034 [US2] Test rapid state updates (add multiple layers quickly) and verify no crashes or visual artifacts
- [ ] T035 [US2] Verify OSM basemap is present in state when inspecting mapStore.context.layers

**Checkpoint**: User Story 2 complete - State management API fully functional and independently testable

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and documentation that affect the overall implementation

- [ ] T036 [P] Remove unused files: src/stores/counter.ts (if exists)
- [ ] T037 [P] Remove unused files: src/views/HomeView.vue, src/views/AboutView.vue (if exist)
- [ ] T038 [P] Remove unused files: src/components/HelloWorld.vue, src/components/TheWelcome.vue, src/components/WelcomeItem.vue (if exist)
- [ ] T039 [P] Remove unused files: src/components/icons/ directory (if exists)
- [ ] T040 [P] Add TypeScript type imports to all files following constitution standards
- [ ] T041 [P] Verify ESLint and Prettier configuration for code quality
- [ ] T042 Run quickstart.md manual testing checklist
- [ ] T043 Verify all acceptance scenarios from spec.md are met
- [ ] T044 Run production build: npm run build
- [ ] T045 Verify build completes without TypeScript errors
- [ ] T046 Test production build in browser

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (Phase 3) completion - builds on existing store
- **Polish (Phase 5)**: Depends on both User Stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 store implementation - Extends store with additional actions

### Within Each User Story

**User Story 1 (P1)**:
- T007, T008 can run in parallel (different files)
- T009, T010, T011 depend on T007 (map.store.ts exists)
- T012, T013, T014, T015, T016 depend on T008 (MapViewer.vue exists)
- T017 depends on T007 (map.store.ts exists)
- T018 depends on T008 (MapViewer.vue exists)
- T019 is independent
- T020 is independent
- T021-T024 are sequential verification tasks

**User Story 2 (P2)**:
- T025, T026, T027, T028, T029, T030 all modify map.store.ts - sequential execution required
- T031-T035 are sequential verification tasks

### Parallel Opportunities

- **Phase 1**: T003 and T004 can run in parallel
- **Phase 2**: T005 and T006 can run in parallel
- **Phase 3 (User Story 1)**: T007 and T008 can run in parallel
- **Phase 5**: T036, T037, T038, T039, T040, T041 can all run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch store and component file creation together:
Task: "Create src/stores/map.store.ts with Pinia store structure"
Task: "Create src/components/map/MapViewer.vue component file structure"

# After those complete, implement store features sequentially:
Task: "Implement MapContext initialization in src/stores/map.store.ts"
Task: "Implement computed getters in src/stores/map.store.ts"

# And implement component features sequentially:
Task: "Implement MapViewer template in src/components/map/MapViewer.vue"
Task: "Implement onMounted lifecycle hook in src/components/map/MapViewer.vue"
```

---

## Parallel Example: Phase 5 (Polish)

```bash
# Launch all file cleanup tasks together:
Task: "Remove unused files: src/stores/counter.ts"
Task: "Remove unused files: src/views/HomeView.vue, src/views/AboutView.vue"
Task: "Remove unused files: src/components/HelloWorld.vue, src/components/TheWelcome.vue"
Task: "Remove unused files: src/components/icons/ directory"
Task: "Add TypeScript type imports to all files"
Task: "Verify ESLint and Prettier configuration"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup → Dependencies installed
2. Complete Phase 2: Foundational → Config and utilities ready
3. Complete Phase 3: User Story 1 → Full-screen map with OSM basemap
4. **STOP and VALIDATE**: Run independent test for User Story 1
5. Deploy/demo MVP if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T006)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T007-T024)
3. Add User Story 2 → Test independently → Deploy/Demo (T025-T035)
4. Polish → Clean up and finalize (T036-T046)

### Single Developer Strategy

1. Complete Setup (T001-T004) → ~5-10 minutes
2. Complete Foundational (T005-T006) → ~10-15 minutes
3. Complete User Story 1 (T007-T024) → ~2-3 hours
4. **CHECKPOINT**: Validate MVP works
5. Complete User Story 2 (T025-T035) → ~1-2 hours
6. Complete Polish (T036-T046) → ~30-60 minutes

**Total Estimated Time**: 4-7 hours for complete implementation

---

## Success Criteria Validation

### User Story 1 Success Criteria

- ✅ **SC-001**: Map loads and becomes interactive within 3 seconds → Test at T021
- ✅ **SC-002**: Map fills 100% viewport on all screen sizes → Test at T024
- ✅ **SC-003**: 60 fps pan/zoom interactions → Test at T022, T023
- ✅ **SC-005**: Responsive during viewport resize → Test at T024
- ✅ **SC-006**: OSM base layer loads successfully → Test at T021

### User Story 2 Success Criteria

- ✅ **SC-004**: Developer can add layer, reflected on map within 100ms → Test at T031

### Functional Requirements Coverage

- ✅ **FR-001**: Full-screen map → Implemented in T012, verified in T021
- ✅ **FR-002**: OSM as default base layer → Implemented in T006, verified in T021
- ✅ **FR-003**: Centralized state management → Implemented in T007-T011
- ✅ **FR-004**: Support adding layers → Implemented in T027, verified in T031
- ✅ **FR-005**: Support removing layers → Implemented in T028, verified in T032
- ✅ **FR-006**: Support updating layer properties → Implemented in T029, verified in T033
- ✅ **FR-007**: Respond to pan interactions → Implemented in T016, verified in T022
- ✅ **FR-008**: Respond to zoom interactions → Implemented in T016, verified in T023
- ✅ **FR-009**: Auto-adjust on resize → Implemented in T012-T014, verified in T024
- ✅ **FR-010**: No UI controls → Ensured throughout implementation
- ✅ **FR-011**: Persist view configuration → Implemented in T017
- ✅ **FR-012**: Gracefully handle tile loading failures → OpenLayers handles this by default

---

## Notes

- [P] tasks = different files, no dependencies, can execute in parallel
- [US1]/[US2] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No test tasks included - feature specification does not request tests
- TypeScript strict mode requires helper functions for MapContextLayer union types (T025-T026)
- Immutable update patterns required by constitution principle (all store actions)
- Constitution compliance verified throughout implementation
