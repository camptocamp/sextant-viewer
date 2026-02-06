# Tasks: Map Feature Click Popup

**Input**: Design documents from `/specs/002-map-feature-click-popup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - manual testing only per Testing Plan in plan.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- Paths use Vue/TypeScript conventions per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and types setup

- [x] T001 [P] Create TypeScript types for feature selection in `src/types/feature-selection.types.ts`
- [x] T002 [P] Create feature selection Pinia store in `src/stores/featureSelection.store.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `getLayerName()` function to `src/utils/layer.utils.ts`
- [x] T004 Create `useFeatureInfo` composable in `src/composables/useFeatureInfo.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Feature Details on Click (Priority: P1) 🎯 MVP

**Goal**: Click on a vector feature to display a popup with layer name, feature ID, and all attributes

**Independent Test**: Load map with vector layers, click on any feature, verify popup displays correct information

### Implementation for User Story 1

- [x] T005 [US1] Create `useMapFeatureInteraction` composable (click handler only) in `src/composables/useMapFeatureInteraction.ts`
- [x] T006 [US1] Create `FeaturePopupContent.vue` presentational component in `src/components/map/FeaturePopupContent.vue`
- [x] T007 [US1] Create `FeaturePopup.vue` container with OpenLayers Overlay in `src/components/map/FeaturePopup.vue` (Note: replaced UPopover with custom styled div since UPopover requires a trigger element)
- [x] T008 [US1] Integrate FeaturePopup and useMapFeatureInteraction in `src/components/map/MapViewer.vue`
- [x] T009 [US1] Add selection highlight style to selected features in `src/composables/useMapFeatureInteraction.ts`

**Checkpoint**: User Story 1 complete - click on feature shows popup with all attributes

---

## Phase 4: User Story 2 - Visual Feedback on Hover (Priority: P2)

**Goal**: Cursor changes to pointer and feature highlights when hovering over clickable features

**Independent Test**: Move mouse over features, verify cursor change and highlight effect

### Implementation for User Story 2

- [x] T010 [US2] Create `useFeatureHighlight` composable in `src/composables/useFeatureHighlight.ts`
- [x] T011 [US2] Add pointermove handler for cursor change in `src/composables/useMapFeatureInteraction.ts`
- [x] T012 [US2] Integrate hover highlight with useFeatureHighlight in `src/components/map/MapViewer.vue`

**Checkpoint**: User Story 2 complete - hover shows pointer cursor and feature highlight

---

## Phase 5: User Story 3 - Navigate to URLs in Attributes (Priority: P3)

**Goal**: HTTP/HTTPS URLs in attribute values are rendered as clickable links opening in new tabs

**Independent Test**: Click on feature with URL attributes, verify URLs are clickable links

### Implementation for User Story 3

- [x] T013 [US3] Create `extractUrls()` utility function in `src/utils/url.utils.ts`
- [x] T014 [US3] Update FeaturePopupContent to render URLs as links in `src/components/map/FeaturePopupContent.vue`
- [x] T015 [US3] Update useFeatureInfo to extract URLs from attribute values in `src/composables/useFeatureInfo.ts`

**Checkpoint**: User Story 3 complete - URLs in attributes are clickable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T016 [P] Handle edge case: feature with no attributes in `src/components/map/FeaturePopupContent.vue`
- [x] T017 [P] Handle edge case: feature with no ID ("Objet sans identifiant") in `src/composables/useFeatureInfo.ts`
- [x] T018 [P] Handle edge case: null/undefined attribute values in `src/composables/useFeatureInfo.ts`
- [x] T019 Verify autopan behavior works correctly in `src/components/map/FeaturePopup.vue`
- [x] T020 Manual testing per Testing Plan: WFS, GeoJSON, edge cases

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories should proceed sequentially in priority order (P1 → P2 → P3)
  - US2 extends useMapFeatureInteraction from US1
  - US3 extends FeaturePopupContent and useFeatureInfo from US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (extends useMapFeatureInteraction)
- **User Story 3 (P3)**: Depends on US1 (extends FeaturePopupContent and useFeatureInfo)

### Within Each Phase

- T001 and T002 can run in parallel (different files)
- T003 must complete before T004 (useFeatureInfo uses getLayerName)
- T005 before T006-T007 (composable before components)
- T006 and T007 can be developed in parallel
- T008 integrates everything from US1
- T016, T017, T018 can run in parallel (different edge cases)

### Parallel Opportunities

- T001, T002 (Setup tasks)
- T016, T017, T018 (Polish edge case tasks)
- Within each user story, model/utility tasks can often parallel component tasks

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Create TypeScript types for feature selection in src/types/feature-selection.types.ts"
Task: "Create feature selection Pinia store in src/stores/featureSelection.store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T009)
4. **STOP and VALIDATE**: Test clicking on features
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test clicking → Deploy/Demo (MVP!)
3. Add User Story 2 → Test hovering → Deploy/Demo
4. Add User Story 3 → Test URL links → Deploy/Demo
5. Complete Polish → Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No automated tests required - use manual Testing Plan from plan.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US2 and US3 extend files from US1, so sequential execution recommended
