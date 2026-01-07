---
description: "Task list for Layer Manager implementation"
---

# Tasks: Layer Manager

**Input**: Design documents from `/specs/003-layer-manager/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Tests are OPTIONAL per project constitution - not included in this task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, at repository root
- Paths shown below follow Vue.js project structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure

- [X] T001 Create layer components directory at src/components/layer/
- [X] T002 Create types directory at src/types/ (if not exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions and store actions that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create layer type definitions in src/types/layer.ts with LayerMenuItem interface, isBasemapLayer type guard, and getLayerLabel utility function
- [X] T004 [P] Import removeLayerFromContext from @geospatial-sdk/core in src/stores/map.store.ts
- [X] T005 Add deleteLayer action to map store in src/stores/map.store.ts that uses removeLayerFromContext to remove layer immutably

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Layer List (Priority: P1) 🎯 MVP

**Goal**: Display all non-basemap layers in reverse stacking order with truncated labels and empty state support

**Independent Test**: Load map with multiple layers, verify layer manager displays layers in correct order (topmost layer at top of list), basemap excluded, empty state shows when no data layers exist

### Implementation for User Story 1

- [X] T006 [US1] Create LayerManager.vue component in src/components/layer/LayerManager.vue with script setup block and TypeScript
- [X] T007 [US1] Import useMapStore and connect to Pinia store in src/components/layer/LayerManager.vue
- [X] T008 [US1] Create computed property dataLayers in src/components/layer/LayerManager.vue that filters out basemap layers using isBasemapLayer and reverses array order
- [X] T009 [US1] Implement component template in src/components/layer/LayerManager.vue with header, empty state using UEmpty component (icon: i-heroicons-queue-list, message: "No layers added")
- [X] T010 [US1] Add layer list rendering in src/components/layer/LayerManager.vue using v-for over dataLayers with layer.id as key
- [X] T011 [US1] Implement layer label display with truncation in src/components/layer/LayerManager.vue using UTooltip wrapping truncated span with Tailwind truncate class
- [X] T012 [US1] Add Tailwind styling in src/components/layer/LayerManager.vue for layout (flex, gap, hover states) ensuring component size stays under 200 lines

**Checkpoint**: At this point, User Story 1 should be fully functional - layer list displays correctly, updates reactively, shows empty state

---

## Phase 4: User Story 2 - Delete Layer via Context Menu (Priority: P2)

**Goal**: Enable users to delete layers through a context menu accessed via dot icon button

**Independent Test**: Open layer manager with existing layers, click menu icon next to any layer, select "Delete layer" option, verify layer removed from list and map

### Implementation for User Story 2

- [X] T013 [US2] Create getMenuItems function in src/components/layer/LayerManager.vue that returns LayerMenuItem array with "Delete layer" option (icon: i-heroicons-trash)
- [X] T014 [US2] Implement handleDeleteLayer function in src/components/layer/LayerManager.vue that validates layer.id and calls mapStore.deleteLayer
- [X] T015 [US2] Add UDropdownMenu component to layer list items in src/components/layer/LayerManager.vue with getMenuItems bound to items prop
- [X] T016 [US2] Add UButton trigger inside UDropdownMenu in src/components/layer/LayerManager.vue with icon i-heroicons-ellipsis-vertical, variant ghost, size xs, disabled when no layer.id
- [X] T017 [US2] Verify context menu closes on click-outside and after action selection in src/components/layer/LayerManager.vue (UDropdownMenu default behavior)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can view layers and delete them via context menu

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and integration

- [X] T018 [P] Integrate LayerManager component into main application layout (src/views/MapView.vue or appropriate layout file)
- [X] T019 [P] Run type checking with npm run type-check and fix any TypeScript errors in src/components/layer/LayerManager.vue and src/stores/map.store.ts
- [X] T020 [P] Run linting with npm run lint and format code with npm run format for all modified files
- [X] T021 Verify component size is under 200 lines using wc -l src/components/layer/LayerManager.vue
- [X] T022 Verify all functions are under 20 lines in src/components/layer/LayerManager.vue
- [X] T023 Verify no any types used - check all files have strict TypeScript compliance
- [ ] T024 Manual testing of User Story 1 acceptance scenarios (5 scenarios from spec.md)
- [ ] T025 Manual testing of User Story 2 acceptance scenarios (6 scenarios from spec.md)
- [ ] T026 Manual testing of edge cases from spec.md (6 edge cases)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion (requires layer list UI to exist)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 (needs layer list UI and items to add menu to)

### Within Each User Story

**User Story 1 Flow**:
1. T006: Create component file
2. T007-T008: Connect to store and create computed property (can happen together)
3. T009-T010: Build template structure (empty state, list container)
4. T011-T012: Add details (tooltips, styling)

**User Story 2 Flow**:
1. T013-T014: Create functions for menu and deletion
2. T015-T016: Add UI components (menu, button)
3. T017: Verify behavior

### Parallel Opportunities

- **Setup Phase**: Both T001 and T002 can run in parallel
- **Foundational Phase**: T003, T004, T005 can run in parallel (T004-T005 same file but different sections)
- **Polish Phase**: T018, T019, T020 can run in parallel (different concerns)

---

## Parallel Example: Foundational Phase

```bash
# Launch foundational tasks together:
Task T003: "Create layer type definitions in src/types/layer.ts"
Task T004: "Import removeLayerFromContext in src/stores/map.store.ts"
Task T005: "Add deleteLayer action in src/stores/map.store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005) - CRITICAL
3. Complete Phase 3: User Story 1 (T006-T012)
4. **STOP and VALIDATE**: Test User Story 1 acceptance scenarios
5. Demo layer list viewing functionality

### Incremental Delivery

1. Complete Setup + Foundational → T001-T005 done
2. Add User Story 1 → T006-T012 → Test independently → Demo (MVP!)
3. Add User Story 2 → T013-T017 → Test independently → Demo
4. Polish → T018-T026 → Final verification
5. Each story adds value without breaking previous functionality

---

## Task Summary

**Total Tasks**: 26 tasks

**Task Breakdown by Phase**:
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 3 tasks
- Phase 3 (User Story 1): 7 tasks
- Phase 4 (User Story 2): 5 tasks
- Phase 5 (Polish): 9 tasks

**Task Breakdown by User Story**:
- User Story 1 (P1): 7 implementation tasks
- User Story 2 (P2): 5 implementation tasks
- Shared infrastructure: 5 tasks (setup + foundational)
- Polish/verification: 9 tasks

**Parallel Opportunities**: 6 tasks marked with [P] can run in parallel with others in their phase

**Critical Path**:
1. Setup (T001-T002) →
2. Foundational (T003-T005) →
3. US1 Implementation (T006-T012) →
4. US2 Implementation (T013-T017) →
5. Polish (T018-T026)

**Minimum Viable Product (MVP)**: Complete through T012 (User Story 1) for basic layer viewing functionality

---

## File Modification Summary

### New Files Created

- `src/components/layer-manager/LayerManager.vue` - Main layer manager component (T006)
- `src/composables/useLayerManagement.ts` - Layer manager capabilities (T006)
- `src/types/layer.ts` - Layer type definitions and utilities (T003)
- `src/types/` directory if not exists (T002)
- `src/components/layer/` directory (T001)

### Files Modified

- `src/stores/map.store.ts` - Add deleteLayer action and import (T004, T005)
- Layout file (e.g., `src/views/MapView.vue`) - Integrate LayerManager component (T018)

### Files Validated

- All TypeScript files - Type checking (T019)
- All source files - Linting and formatting (T020)
- LayerManager.vue - Size and function length checks (T021, T022)
- All implementation files - Manual testing (T024-T026)

---

## Constitution Compliance Verification

Each task is designed to maintain compliance with project constitution principles:

- ✅ **Principle I (MapContext Source of Truth)**: T005 adds store action, T007-T008 connect to store
- ✅ **Principle II (Vue.js Best Practices)**: T006 creates component with script setup
- ✅ **Principle III (Clean Code)**: T022 verifies function length ≤ 20 lines
- ✅ **Principle IV (Component Architecture)**: T021 verifies component size ≤ 200 lines, T001 ensures feature-based organization
- ✅ **Principle V (TypeScript-First)**: T003 creates types, T019 runs type checking, T023 verifies no any types
- ✅ **Principle VI (Geospatial-SDK)**: T004 uses removeLayerFromContext from SDK
- ✅ **Principle VII (Craftsmanship)**: T020 enforces lint/format, T019-T023 quality checks
- ✅ **Principle VIII (NuxtUI Components)**: T009 uses UEmpty, T011 uses UTooltip, T015-T016 use UDropdownMenu/UButton

---

## Notes

- Tasks use [P] marker for parallelizable work (different files or independent concerns)
- Tasks use [US1]/[US2] labels to map to user stories from spec.md
- Each user story phase is independently completable and testable
- MVP scope is User Story 1 (T001-T012 plus foundational)
- No test tasks included - tests are optional per project constitution
- Component integration (T018) can be done at any point after T012
- Verification tasks (T019-T026) should be done after all implementation complete
- Estimated implementation time: 2-3 hours for MVP, 3-4 hours for full feature

---

## Execution Checklist

Before starting:
- [ ] Review spec.md for user story acceptance criteria
- [ ] Review plan.md for technical context and constitution compliance
- [ ] Review data-model.md for type definitions
- [ ] Review quickstart.md for detailed implementation guidance

During implementation:
- [ ] Complete tasks in phase order (Setup → Foundational → US1 → US2 → Polish)
- [ ] Mark each task as complete when fully implemented
- [ ] Test acceptance scenarios after completing each user story
- [ ] Commit after each logical group of tasks

After implementation:
- [ ] All 26 tasks marked complete
- [ ] All acceptance scenarios passing
- [ ] Type checking, linting, formatting passing
- [ ] Component size and function length requirements met
- [ ] Ready for code review and merge
