# Implementation Plan: Panel Overlay Grid System

**Branch**: `001-panel-overlay-grid` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-panel-overlay-grid/spec.md`

## Summary

This feature transforms the existing single-panel overlay into a dynamic 5-section grid system that displays panels based on user interaction. The leftmost panel (width 110 units) remains permanently visible with a tabbed interface ("Layers" and "Tree" tabs) containing the layer manager. When users select a layer, a second panel dynamically appears to the right showing layer details. The implementation uses Tailwind CSS utilities for grid layout (desktop only, mobile shows single column), separate Pinia stores for layer and layout state, NuxtUI for tab components, and maintains MapContext as the source of truth for layer data. Layer selection is stored as the full MapContextLayer object, not just an ID.

## Technical Context

**Language/Version**: TypeScript 5.9+ with strict mode, Vue 3.5.26
**Primary Dependencies**: Vue 3.5+, @nuxt/ui 4.3+, Pinia 3.0+, @geospatial-sdk/core 0.0.5-dev.44, @geospatial-sdk/openlayers 0.0.5-dev.44, OpenLayers 10.7+
**Storage**: Browser state (Pinia stores), no persistent storage required
**Testing**: Vitest for unit tests, Playwright for E2E (existing setup)
**Target Platform**: Modern web browsers (desktop and mobile), responsive design
**Project Type**: Single-page Vue application (Vite-based)
**Performance Goals**: Panel transitions <100ms, smooth animations at 60fps, no layout jank during grid changes
**Constraints**: Must maintain existing MapContext pattern, must use NuxtUI components exclusively, panels must not interfere with map interactions
**Scale/Scope**: 5 grid sections (desktop), 1 column (mobile), 2 panel types (Layer Panel, Layer Details Panel), ~6-8 new components, two Pinia stores (layers.store.ts, layout.store.ts) for state management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: MapContext as Source of Truth
✅ **COMPLIANT**: Layer data comes from MapContext via Pinia store. No direct OpenLayers manipulation for layer information. Panel system reads layer state but doesn't modify MapContext structure.

### Principle II: Vue.js Best Practices
✅ **COMPLIANT**: All new components will use `<script setup>` syntax. State managed through Pinia with Composition API. Reactive dependencies properly declared in `ref()`, `computed()`, and `watch()`.

### Principle III: Clean Code & SOLID Principles
✅ **COMPLIANT**: Components follow single responsibility (PanelGrid manages layout, LayerPanel handles tabs, LayerDetailsPanel shows details). No premature abstractions - simple props/events pattern.

### Principle IV: Component Architecture
✅ **COMPLIANT**: Atomic structure maintained. New components organized under `components/layout/`. Container/presentation separation (LayoutGrid = container, individual panels = presentation). Components will stay under 200 lines.

### Principle V: TypeScript-First Development
✅ **COMPLIANT**: All components strictly typed. Layer selection state typed with geospatial-sdk types. No `any` usage. Panel props explicitly typed.

### Principle VI: Geospatial-SDK Integration
✅ **COMPLIANT**: Uses existing MapContextLayer types from geospatial-sdk. Layers accessed through MapContext, not directly from OpenLayers. No custom layer implementations.

### Principle VII: Software Craftsmanship
✅ **COMPLIANT**: ESLint/Prettier configured. No commented code. Technical debt will be minimal (straightforward UI layout feature).

### Principle VIII: NuxtUI Component Library Standard
✅ **COMPLIANT**: Tabs use `<UTabs>` component. Cards/panels use `<UCard>`. All UI elements from NuxtUI library. No custom UI components.

### Principle IX: Minimal Comments Standard
✅ **COMPLIANT**: Self-documenting code through clear naming (`selectedLayer`, `isPanelVisible`, `handleLayerSelection`). Comments only for non-obvious grid logic if needed.

**GATE STATUS**: ✅ **PASSED** - No violations. Feature aligns with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-panel-overlay-grid/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── layer-state.ts   # Layer selection state types
│   └── layout-state.ts  # Layout/panel visibility state types
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── map/
│   │   └── MapViewer.vue              # Existing - unchanged
│   ├── layer-manager/
│   │   └── LayerManager.vue           # Existing - will be embedded in LayerPanel
│   └── layout/                         # NEW - layout system components
│       ├── LayoutGrid.vue             # Grid container (5 sections desktop, 1 mobile)
│       ├── LayerPanel.vue             # Leftmost panel with tabs
│       └── LayerDetailsPanel.vue      # Dynamic details panel
├── composables/
│   ├── useLayerManagement.ts          # Existing - unchanged
│   ├── useLayerSelection.ts           # NEW - layer selection state access
│   └── useLayoutState.ts              # NEW - layout/panel visibility state access
├── stores/
│   ├── map.store.ts                   # Existing - unchanged
│   ├── layers.store.ts                # NEW - layer selection state
│   └── layout.store.ts                # NEW - layout/panel visibility state
├── types/
│   ├── layer.ts                       # NEW - layer state types
│   └── layout.ts                      # NEW - layout state types
└── App.vue                             # Modified - replace hardcoded panel with LayoutGrid

tests/
├── unit/
│   └── components/
│       └── layout/                     # NEW - layout component tests
│           ├── LayoutGrid.spec.ts
│           ├── LayerPanel.spec.ts
│           └── LayerDetailsPanel.spec.ts
└── e2e/
    └── layout-interactions.spec.ts     # NEW - E2E tests for layout behavior
```

**Structure Decision**: Single-page Vue application structure (existing). New layout components added under `components/layout/` following the feature-based organization pattern established in the codebase. Separate Pinia stores for layers (selection) and layout (panel visibility). Composables provide convenient access to each store. Types directory holds separate interfaces for layer and layout concerns.

## Complexity Tracking

*No complexity violations - feature fully compliant with constitution.*

---

## Phase 0: Research & Technical Decisions

*See [research.md](./research.md) for detailed findings.*

### Research Areas

1. **Tailwind CSS Grid Layout for Dynamic Panel System**
   - Tailwind grid utilities for 5-column desktop layout
   - Mobile-first responsive design (single column on mobile)
   - Conditional grid classes based on panel count
   - Smooth transitions when panels appear/disappear

2. **NuxtUI Tabs Component Integration**
   - `<UTabs>` API and props for Layers/Tree tabs
   - Tab state management (controlled vs uncontrolled)
   - Integrating existing LayerManager component within tab content

3. **Separate Store Architecture (Layers + Layout)**
   - layers.store.ts: Store full MapContextLayer object (not just ID)
   - layout.store.ts: Panel visibility and grid configuration
   - Communication pattern between the two stores
   - Event flow: click layer → update layers store → layout store reacts

4. **Panel Transition Performance**
   - CSS transitions vs animations for panel appearance
   - Hardware acceleration for smooth 60fps animations
   - Avoiding layout thrashing during grid changes

5. **Layer Details Panel Content**
   - What layer properties to display (name, type, visibility, metadata)
   - Accessing layer metadata from MapContextLayer
   - Fallback UI when no details available

6. **Responsive Behavior (Desktop vs Mobile)**
   - Breakpoint for switching between grid and single column
   - Mobile panel stacking/navigation patterns
   - Touch interactions for mobile devices

---

## Phase 1: Design Artifacts

*Detailed design documents generated after research completion.*

### Artifacts to Generate

1. **data-model.md**: State shape for layout system
   - Layer selection state (layers.store.ts)
   - Layout/panel visibility state (layout.store.ts)
   - Grid configuration for desktop and mobile
   - Store communication patterns

2. **contracts/layer-state.ts**: Layer selection types
   - `LayerSelectionState` interface
   - Full MapContextLayer storage (not ID)
   - Selection actions and computed properties

3. **contracts/layout-state.ts**: Layout/panel visibility types
   - `LayoutState` interface
   - `PanelConfig` interface
   - `GridConfig` interface for desktop/mobile
   - Responsive breakpoint configuration

4. **quickstart.md**: Component usage guide
   - How to use LayoutGrid component
   - Layer and layout state management examples
   - Adding new panel types to grid
   - Mobile vs desktop responsive behavior

---

## Post-Phase 1: Constitution Re-Check

*Completed after Phase 1 design artifacts generation.*

### Re-Evaluation Results

All design artifacts have been reviewed against the constitution:

✅ **Principle I: MapContext as Source of Truth**
- COMPLIANT: Data model uses MapContextLayer types from geospatial-sdk
- Layer data accessed through MapContext in store
- No direct OpenLayers manipulation in panel components

✅ **Principle II: Vue.js Best Practices**
- COMPLIANT: All component examples use `<script setup>` syntax
- State managed through Pinia with Composition API patterns
- Proper use of `ref()`, `computed()`, and reactive dependencies

✅ **Principle III: Clean Code & SOLID Principles**
- COMPLIANT: Single responsibility maintained across components
- PanelGrid manages layout only
- LayerPanel manages tab interface only
- LayerDetailsPanel displays layer info only
- No premature abstractions (simple props/events)

✅ **Principle IV: Component Architecture**
- COMPLIANT: Atomic structure maintained
- Components organized in `components/panel/` directory
- Clear separation: PanelGrid (container) vs LayerPanel/LayerDetailsPanel (presentation)
- Composable (`usePanelState`) extracts reusable logic
- Component sizes will stay under 200 lines based on quickstart examples

✅ **Principle V: TypeScript-First Development**
- COMPLIANT: All interfaces strictly typed in contracts/panel-state.ts
- No `any` usage in type definitions
- Proper use of union types (PanelType, GridColumnCount)
- Type imports from authoritative sources (@geospatial-sdk/core)

✅ **Principle VI: Geospatial-SDK Integration**
- COMPLIANT: Uses MapContextLayer type for all layer data
- No custom layer types or structures
- Leverages existing geospatial-sdk abstractions

✅ **Principle VII: Software Craftsmanship**
- COMPLIANT: Clear interfaces, documented types
- Testing strategy included in quickstart
- No technical debt introduced

✅ **Principle VIII: NuxtUI Component Library Standard**
- COMPLIANT: Exclusive use of NuxtUI components verified in quickstart examples
- UTabs for tab interface
- UCard for panel containers
- UButton, UIcon, UBadge, UEmpty for UI elements
- No custom UI components created

✅ **Principle IX: Minimal Comments Standard**
- COMPLIANT: Quickstart examples use self-documenting code
- Clear naming: `selectedLayer`, `isDetailsVisible`, `handleLayerClick`
- JSDoc comments in contracts only explain interface purpose, not implementation

**FINAL GATE STATUS**: ✅ **PASSED** - All design artifacts comply with constitution. Ready for task breakdown.

---

## Implementation Notes

### Key Design Decisions

1. **Grid Implementation**: Tailwind CSS grid utilities, 5 columns desktop, 1 column mobile
2. **State Architecture**: Two separate Pinia stores
   - `layers.store.ts`: Stores full MapContextLayer object (not ID)
   - `layout.store.ts`: Panel visibility and grid configuration
3. **Tab Component**: NuxtUI `<UTabs>` for Layer Panel tabs
4. **Layer Click Handler**: LayerManager → LayerPanel → layers.store → layout.store reacts
5. **Responsive Behavior**: Desktop uses grid (5 columns max), mobile uses single column
6. **Component Folder**: All layout components in `components/layout/`

### Dependencies on Existing Code

- **LayerManager.vue**: Must add click handlers to layer items, emit selection events with full layer object
- **map.store.ts**: Unchanged (no modifications needed)
- **App.vue**: Replace hardcoded panel div with LayoutGrid component

### Testing Strategy

- **Unit Tests**: Test panel visibility logic, tab switching, selection state updates
- **E2E Tests**: Test full user flow (load app → see panel → click layer → see details → deselect)
- **Visual Tests**: Verify smooth animations, no layout jank, responsive behavior

---

**Next Steps**:
1. Execute Phase 0 research (generates `research.md`)
2. Execute Phase 1 design (generates `data-model.md`, `contracts/`, `quickstart.md`)
3. Update agent context
4. Re-evaluate constitution compliance
5. Proceed to `/speckit.tasks` for task breakdown
