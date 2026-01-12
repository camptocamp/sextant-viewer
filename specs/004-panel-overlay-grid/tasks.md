# Tasks: Panel Overlay Grid System

**Input**: Design documents from `/specs/001-panel-overlay-grid/`
**Prerequisites**: plan.md, spec.md, research.md
**Branch**: `001-panel-overlay-grid`

**Tests**: No test tasks included (not requested in specification)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project structure at repository root:
- `src/` - Application source code
- `tests/` - Test files (unit and E2E)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [x] T001 Create type definitions in src/types/layer.ts for layer selection state
- [x] T002 Create type definitions in src/types/layout.ts for layout/panel visibility state

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state management infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create layers.store.ts in src/stores/layers.store.ts with selectedLayer ref and actions
- [x] T004 Create layout.store.ts in src/stores/layout.store.ts with computed visibility state
- [x] T005 [P] Create useLayerSelection composable in src/composables/useLayerSelection.ts
- [x] T006 [P] Create useLayoutState composable in src/composables/useLayoutState.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Organized Layer List (Priority: P1) 🎯 MVP

**Goal**: Display leftmost panel with tabbed interface containing layer manager

**Independent Test**: Load application and verify leftmost panel is visible with "Layers" tab active showing layer list

**Value Delivered**: Users have consistent access to layer management in an organized panel system

**Acceptance Criteria**:
- Leftmost panel (w-110) visible on page load
- Tab interface with "Layers" and "Tree" tabs displayed
- "Layers" tab active by default showing layer manager
- All map layers displayed in scrollable list

### Tasks

- [x] T007 [US1] Create LayoutGrid component in src/components/layout/LayoutGrid.vue with Tailwind grid classes
- [x] T008 [US1] Implement responsive grid (desktop: 5 columns, mobile: 1 column) in LayoutGrid.vue
- [x] T009 [US1] Create LayerPanel component in src/components/layout/LayerPanel.vue with UCard wrapper
- [x] T010 [US1] Implement UTabs component in LayerPanel.vue with "Layers" and "Tree" tabs
- [x] T011 [US1] Embed existing LayerManager component in "Layers" tab slot
- [x] T012 [US1] Create placeholder content for "Tree" tab with "coming soon" message
- [x] T013 [US1] Update App.vue to replace hardcoded panel div with LayoutGrid component
- [x] T014 [US1] Add CSS transitions for smooth panel animations (150ms opacity/transform)
- [x] T015 [US1] Ensure pointer-events correct (grid: none, panels: auto) for map interaction

**Story 1 Complete**: ✅ MVP feature ready - users can view organized layer list in tabbed panel

---

## Phase 4: User Story 2 - Select Layer to View Details (Priority: P2)

**Goal**: Enable layer selection and display details panel dynamically

**Independent Test**: Click any layer in layer list and verify second panel appears to the right with layer details

**Value Delivered**: Users can inspect individual layer properties without cluttering the main list

**Acceptance Criteria**:
- Layer becomes visually highlighted when clicked
- Second panel appears immediately to the right (within 100ms)
- Panel displays layer type, visibility, opacity, zoom range, attribution, metadata
- Panel updates when different layer selected
- Panel disappears when layer deselected (click same layer again or close button)
- Grid dynamically adjusts from 1 column to 2 columns (desktop)

### Tasks

- [x] T016 [US2] Modify LayerManager.vue to emit selectLayer event on layer click
- [x] T017 [US2] Add click handler in LayerManager.vue passing full MapContextLayer object
- [x] T018 [US2] Update LayerPanel.vue to handle selectLayer event and call layers.store.selectLayer()
- [x] T019 [US2] Add visual highlight for selected layer in LayerManager.vue using selectedLayer from store
- [x] T020 [US2] Create LayerDetailsPanel component in src/components/layout/LayerDetailsPanel.vue
- [x] T021 [P] [US2] Implement layer type display with UBadge in LayerDetailsPanel.vue
- [x] T022 [P] [US2] Implement visibility status display with UIcon in LayerDetailsPanel.vue
- [x] T023 [P] [US2] Implement opacity display (percentage) in LayerDetailsPanel.vue
- [x] T024 [P] [US2] Implement zoom range display (min-max) in LayerDetailsPanel.vue
- [x] T025 [P] [US2] Implement attribution display in LayerDetailsPanel.vue
- [x] T026 [P] [US2] Implement metadata display (key-value pairs) in LayerDetailsPanel.vue
- [x] T027 [P] [US2] Add UEmpty fallback for layers with no additional details in LayerDetailsPanel.vue
- [x] T028 [US2] Add close button (UButton with X icon) in LayerDetailsPanel header
- [x] T029 [US2] Connect close button to layers.store.deselectLayer() action
- [x] T030 [US2] Update LayoutGrid.vue to conditionally render LayerDetailsPanel based on selectedLayer
- [x] T031 [US2] Implement Vue Transition component for panel enter/leave animations
- [x] T032 [US2] Update grid class computation to switch between 1 and 2 columns (desktop)
- [x] T033 [US2] Ensure mobile displays details in UDrawer instead of second column

**Story 2 Complete**: ✅ Users can select layers and view detailed information

---

## Phase 5: User Story 3 - Navigate Between Layer Views (Priority: P3)

**Goal**: Enable tab switching between "Layers" and "Tree" views

**Independent Test**: Click between "Layers" and "Tree" tabs and verify active tab switches with smooth transition

**Value Delivered**: Establishes tab navigation pattern for future layer view enhancements

**Acceptance Criteria**:
- Both "Layers" and "Tree" tabs visible in Layer Panel
- Clicking "Tree" tab switches active tab
- "Tree" tab shows placeholder "coming soon" message
- Tab transitions are smooth with visual indication of active tab
- UTabs handles keyboard navigation automatically

### Tasks

- [x] T034 [US3] Verify UTabs default-value prop sets "Layers" as initial active tab
- [x] T035 [US3] Ensure UTabs items array includes both "Layers" and "Tree" tabs
- [x] T036 [US3] Verify "Tree" tab slot displays placeholder message with UIcon
- [x] T037 [US3] Test tab switching interaction (click, keyboard nav)
- [x] T038 [US3] Verify smooth transition between tab content areas

**Story 3 Complete**: ✅ Tab navigation pattern established

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and responsive behavior

- [x] T039 [P] Verify responsive breakpoint at md: (768px) switches desktop/mobile layouts
- [x] T040 [P] Test mobile drawer pattern for layer details (UDrawer component)
- [x] T041 [P] Ensure panel width (28rem) matches design specification
- [x] T042 [P] Verify all NuxtUI components styled consistently (UCard, UTabs, UButton, UBadge, UIcon, UEmpty)
- [x] T043 [P] Test layer selection toggle (clicking same layer twice deselects)
- [x] T044 [P] Verify map remains interactive when panels are open (pointer-events)
- [x] T045 [P] Test panel animations for smoothness (no jank, 60fps)
- [x] T046 [P] Verify grid adapts responsively on window resize
- [x] T047 [P] Test edge case: layer with no additional details shows UEmpty fallback
- [x] T048 [P] Test edge case: narrow viewport displays mobile single-column layout
- [x] T049 Run ESLint and Prettier to ensure code quality
- [x] T050 Verify all TypeScript types are correctly imported from @geospatial-sdk/core
- [x] T051 Test complete user flow: load → view layers → select → view details → deselect

---

## Dependencies

### Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational)
                       ↓
            ┌──────────┴──────────┬──────────────┐
            ↓                      ↓              ↓
    Phase 3 (US1) 🎯MVP    Phase 4 (US2)   Phase 5 (US3)
            ↓                      ↓              ↓
            └──────────┬───────────┴──────────────┘
                       ↓
            Phase 6 (Polish)
```

**Notes**:
- **US1 (P1)** is MVP - complete this first for basic functionality
- **US2 (P2)** and **US3 (P3)** can be implemented in parallel after US1
- Phase 6 can run in parallel with US2/US3 since tasks target different concerns

### Task Dependencies

**Blocking Dependencies**:
- T007-T015 (US1) depend on T003-T006 (stores and composables)
- T016-T033 (US2) depend on T003-T006 (stores) and T007-T009 (LayoutGrid, LayerPanel)
- T034-T038 (US3) depend on T009-T010 (LayerPanel with UTabs)
- T039-T051 (Polish) can run anytime after US1 complete

**Parallel Opportunities within US2**:
- T021-T027 (LayerDetailsPanel content sections) can be implemented in parallel
- T016-T019 (LayerManager modifications) can run in parallel with T020-T027 (LayerDetailsPanel creation)

---

## Implementation Strategy

### MVP First (Recommended)

Implement **Phase 1 → Phase 2 → Phase 3 (US1)** for minimum viable product:
- Creates foundational panel system
- Displays organized layer list
- Establishes grid layout structure
- Delivers immediate value to users

**MVP Scope**: 15 tasks (T001-T015)

### Incremental Delivery

After MVP, add features incrementally:
1. **US2 (Layer Details)**: Adds inspection capabilities (18 tasks: T016-T033)
2. **US3 (Tab Navigation)**: Completes tab pattern (5 tasks: T034-T038)
3. **Polish**: Final refinements (13 tasks: T039-T051)

---

## Parallel Execution Examples

### During Phase 2 (Foundational)
```bash
# Terminal 1: Stores
T003 (layers.store.ts) + T004 (layout.store.ts)

# Terminal 2: Composables (parallel after stores)
T005 (useLayerSelection.ts) + T006 (useLayoutState.ts)
```

### During Phase 3 (US1)
```bash
# Terminal 1: Components
T007 (LayoutGrid.vue)
T009 (LayerPanel.vue)

# Terminal 2: Styling (after components exist)
T014 (CSS transitions) + T015 (pointer-events)

# Terminal 3: Integration
T013 (App.vue update)
```

### During Phase 4 (US2)
```bash
# Terminal 1: LayerManager modifications
T016-T019 (event emission and highlighting)

# Terminal 2: LayerDetailsPanel structure
T020 (component creation)

# Terminal 3: LayerDetailsPanel content sections (all parallel)
T021 (type) + T022 (visibility) + T023 (opacity) +
T024 (zoom) + T025 (attribution) + T026 (metadata) + T027 (fallback)

# Terminal 4: Integration (after above complete)
T030-T033 (LayoutGrid integration)
```

### During Phase 6 (Polish)
```bash
# All polish tasks (T039-T048) can run in parallel
# Final tasks (T049-T051) run sequentially at end
```

---

## Summary

**Total Tasks**: 51
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (US1 - MVP): 9 tasks
- Phase 4 (US2): 18 tasks
- Phase 5 (US3): 5 tasks
- Phase 6 (Polish): 13 tasks

**Parallel Opportunities**: 23 tasks marked [P] can run in parallel

**MVP Scope**: 15 tasks (Phases 1-3) deliver core value

**Independent Stories**: US2 and US3 can be implemented in any order after US1

**Suggested Approach**: Complete MVP first (US1), then add US2 for full functionality, then US3 for tab navigation, finally polish for production readiness.
