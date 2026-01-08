# Implementation Plan: Layer Manager

**Branch**: `003-layer-manager` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-layer-manager/spec.md`

## Summary

Create a layer manager component that displays all non-basemap layers from the MapContext in reverse stack order (most visible at top), with layer label truncation and a context menu (using NuxtUI components) for layer deletion. The layer manager must reflect real-time MapContext state changes and handle deletions through immutable updates.

**Technical Approach**: Build a Vue component using Composition API that:
1. Connects to existing map Pinia store to access MapContext
2. Filters out basemap layers (identified by id prefix or property)
3. Displays layers using NuxtUI components (UDropdownMenu for context menu, UButton for menu trigger, UEmpty for empty state)
4. Implements layer deletion by updating MapContext through store actions
5. Leverages Vue reactivity to auto-update list when MapContext changes

## Technical Context

**Language/Version**: TypeScript 5.9+ (strict mode)
**Primary Dependencies**: Vue 3.5+, Pinia 3.0+, NuxtUI 4.3+, @geospatial-sdk/core 0.0.5, @geospatial-sdk/openlayers 0.0.5
**Storage**: N/A (stateless component, reads from Pinia store)
**Testing**: Vitest (optional per constitution - not required for MVP)
**Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
**Project Type**: Single web application
**Performance Goals**: Layer list render < 100ms, context menu open/close < 100ms, support up to 50 layers without performance degradation
**Constraints**: Must use NuxtUI components exclusively per constitution principle VIII, must maintain immutable MapContext updates per principle I
**Scale/Scope**: Single feature component (~150-200 lines including template), integrates with existing map.store.ts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: MapContext as Source of Truth ✅

- **Requirement**: Use MapContext from Pinia store as single source of truth
- **Compliance**: Layer manager will read from `useMapStore().context` and update through store actions
- **Verification**: Component does not directly manipulate OpenLayers map, all changes flow through MapContext

### Principle II: Vue.js Best Practices ✅

- **Requirement**: Use Composition API with `<script setup>` syntax
- **Compliance**: Component will use `<script setup>`, defineProps with TypeScript, ref/computed appropriately
- **Verification**: No Options API patterns, proper reactive dependencies

### Principle III: Clean Code & SOLID Principles ✅

- **Requirement**: Single responsibility, functions ≤ 20 lines
- **Compliance**: Component focused solely on layer list display and management, layer deletion logic extracted to store
- **Verification**: Each function has single purpose (filter layers, delete layer, format label)

### Principle IV: Component Architecture ✅

- **Requirement**: Component size ≤ 200 lines, feature-based organization
- **Compliance**: LayerManager.vue placed in `src/components/layer/`, estimated ~150-180 lines
- **Verification**: Component location: `src/components/layer/LayerManager.vue`

### Principle V: TypeScript-First Development ✅

- **Requirement**: Strict TypeScript, types from authoritative sources
- **Compliance**: Import MapContextLayer type from @geospatial-sdk/core, explicit type annotations
- **Verification**: No `any` types, all props/emits typed, proper type guards for basemap detection

### Principle VI: Geospatial-SDK Integration ✅

- **Requirement**: Use geospatial-sdk layer types (MapContextLayer)
- **Compliance**: Component works with MapContextLayer from MapContext, no custom layer types
- **Verification**: Imports from @geospatial-sdk/core, uses existing MapContext structure

### Principle VII: Software Craftsmanship ✅

- **Requirement**: ESLint + Prettier enforced, no commented code
- **Compliance**: Code will pass existing lint/format checks
- **Verification**: Run `npm run lint` before commit

### Principle VIII: NuxtUI Component Library Standard ✅

- **Requirement**: Must use NuxtUI components for all UI elements
- **Compliance**:
  - UDropdownMenu or UContextMenu for context menu
  - UButton with icon for menu trigger
  - UEmpty for empty state
  - UIcon for dot menu icon
- **Verification**: No custom button/menu/empty state components, all UI from @nuxt/ui

**GATE STATUS**: ✅ PASSED - No constitution violations

## Project Structure

### Documentation (this feature)

```text
specs/003-layer-manager/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── components/
│   └── layer-manager/                     # NEW: Layer management components
│       └── LayerManager.vue       # NEW: Main layer manager component
├── composables/
│   └── useLayerManagement.ts      # NEW: Layer management composable (optional)
├── stores/
│   └── map.store.ts               # MODIFIED: Add deleteLayer action
├── types/
│   └── layer.ts                   # NEW: Layer-related type definitions
└── utils/
    └── map-config.ts              # EXISTING: Map configuration

tests/                             # Tests optional per constitution
```

**Structure Decision**: Single project structure (Option 1) as this is a frontend-only Vue.js web application. New components go in `src/components/layer-management/` per feature-based organization principle. Store modifications extend existing `map.store.ts` with layer deletion action.

## Complexity Tracking

> No constitution violations - this section intentionally empty.

---

## Phase 0: Research Findings

**Status**: Complete

### Research Task 1: Basemap Layer Identification Strategy

**Decision**: Identify basemap layers by checking layer id prefix 'basemap-' or by layer position (first layer in array)

**Rationale**:
- Current codebase uses `id: 'basemap-osm'` for the basemap in DEFAULT_MAP_CONTEXT
- Simple string prefix check is performant and explicit
- Fallback to position check (index 0) provides robustness if id convention not followed

**Alternatives Considered**:
- Add explicit `isBasemap` property to MapContextLayer: Rejected because would require extending geospatial-sdk types
- Use layer.type === 'xyz' check: Rejected because data layers can also be XYZ tile layers

**Implementation**:
```typescript
function isBasemapLayer(layer: MapContextLayer, index: number): boolean {
  return layer.id?.startsWith('basemap-') || index === 0
}
```
Add this function in `utils/layer.utils.ts` for reuse.

### Research Task 2: NuxtUI Component Selection for Context Menu

**Decision**: Use UDropdownMenu component for the layer context menu

**Rationale**:
- UDropdownMenu is designed for action menus triggered by buttons (perfect for dot icon → menu pattern)
- Includes built-in positioning, click-outside-to-close, keyboard navigation
- UContextMenu is designed for right-click context menus, not appropriate for this use case
- UDropdownMenu supports items prop with array of menu options

**Alternatives Considered**:
- UContextMenu: Rejected because designed for right-click contexts, not button-triggered menus
- UPopover + custom menu: Rejected because UDropdownMenu provides complete menu functionality

**Implementation**:
```vue
<UDropdownMenu :items="menuItems">
  <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" />
</UDropdownMenu>
```

### Research Task 3: Layer Label Truncation Strategy

**Decision**: Use CSS text-overflow with Tailwind classes, optionally add UTooltip to show full label on hover

**Rationale**:
- CSS truncation (text-overflow: ellipsis) is performant and handles edge cases (long words, special chars)
- Tailwind provides `truncate` utility class
- UTooltip (NuxtUI component) can show full label on hover for accessibility
- No JavaScript string manipulation needed

**Alternatives Considered**:
- JavaScript substring truncation: Rejected because less flexible, doesn't handle container resizing
- Fixed character count truncation: Rejected because doesn't adapt to container width

**Implementation**:
```vue
<UTooltip :text="layer.label">
  <span class="truncate">{{ layer.label }}</span>
</UTooltip>
```

### Research Task 4: MapContext Layer Deletion Pattern

**Decision**: Add `deleteLayer(layerId: string)` action to map.store.ts that creates new MapContext with filtered layers array

**Rationale**:
- Maintains immutable update pattern required by constitution principle I
- Centralized in store following SOLID single responsibility principle
- Enables potential future features (undo, layer history) by keeping deletion logic in one place

**Alternatives Considered**:
- Delete layer directly in component: Rejected because violates separation of concerns
- Emit event to parent component: Rejected because adds unnecessary indirection when store exists

**Implementation**:
```typescript
function deleteLayer(layerId: string) {
  context.value = {
    ...context.value,
    layers: context.value.layers.filter(layer => layer.id !== layerId)
  }
}
```

### Research Task 5: Empty State Messaging

**Decision**: Use UEmpty component with message "No layers added" and optional icon

**Rationale**:
- NuxtUI UEmpty component designed specifically for empty states
- Provides consistent styling with rest of application
- Configurable icon and message

**Implementation**:
```vue
<UEmpty
  icon="i-heroicons-queue-list"
  message="No layers added"
  description="Add layers to the map to see them here"
/>
```

---

## Phase 1: Design Artifacts

### Data Model

See [data-model.md](./data-model.md)

### API Contracts

N/A - This is a frontend component with no API endpoints. Component interface defined in data-model.md.

### Development Quickstart

See [quickstart.md](./quickstart.md)

---

## Implementation Notes

### Component Placement

- **File**: `src/components/layer-manager/LayerManager.vue`
- **Rationale**: Feature-based organization per constitution, `layer/` directory for all layer management features

### Store Extensions

- **File**: `src/stores/map.store.ts`
- **Changes**: Add `deleteLayer(layerId: string)` action
- **Rationale**: Centralize MapContext mutations in store per MapContext as Source of Truth principle

### Type Definitions

- **File**: `src/types/layer.ts` (new)
- **Purpose**: Layer-specific TypeScript types and type guards
- **Rationale**: Centralize type definitions for reuse across components

### Testing Strategy

- **Scope**: Optional per constitution (Vitest not required for MVP)
- **If Implemented**: Component tests for layer filtering, deletion, empty state

### Integration Points

1. **Map Store**: Read `context.value.layers`, call `deleteLayer()`
2. **Layout**: Parent component includes `<LayerManager />` in sidebar or overlay
3. **MapContext Sync**: Reactive updates via Vue computed properties automatically reflect map state changes

---

## Verification Checklist

Before considering implementation complete:

- [ ] LayerManager.vue uses only NuxtUI components (UDropdownMenu, UButton, UEmpty, UTooltip, UIcon)
- [ ] Component uses `<script setup>` with TypeScript
- [ ] Layer filtering excludes basemap (id prefix 'basemap-' or index 0)
- [ ] Layers displayed in reverse array order (last = top of list)
- [ ] Layer labels truncate with ellipsis using CSS
- [ ] Context menu opens on dot icon click
- [ ] "Delete layer" action removes layer from MapContext via store
- [ ] Empty state shows UEmpty component when no data layers
- [ ] Component size ≤ 200 lines
- [ ] All functions ≤ 20 lines
- [ ] ESLint/Prettier passing
- [ ] No `any` types, strict TypeScript
- [ ] deleteLayer action added to map.store.ts
- [ ] Immutable MapContext updates (spread operator, filter)

---

## Next Steps

1. ✅ Phase 0: Research complete (documented above)
2. ✅ Phase 1: Create data-model.md
3. ✅ Phase 1: Create quickstart.md
4. ⏭️ Phase 2: Generate tasks.md via `/speckit.tasks` command
5. ⏭️ Phase 3: Implementation via `/speckit.implement` command

**Current Status**: Planning complete, ready for task generation.
