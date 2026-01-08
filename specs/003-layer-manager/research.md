# Research: Layer Manager Implementation

**Feature**: Layer Manager
**Date**: 2026-01-07
**Status**: Complete

## Overview

This document consolidates research findings for implementing the layer manager component, covering basemap identification, NuxtUI component selection, layer ordering, truncation strategies, and MapContext deletion patterns.

## Research Areas

### 1. Basemap Layer Identification

**Question**: How to reliably identify and filter out basemap/background layers from the layer list?

**Current Implementation Analysis**:
- Examined `src/utils/map-config.ts`
- Default basemap uses id `'basemap-osm'`
- Basemap is always first in layers array (index 0)

**Decision**: Use id prefix check with fallback to array position

**Implementation Strategy**:
```typescript
function isBasemapLayer(layer: MapContextLayer, index: number): boolean {
  return layer.id?.startsWith('basemap-') || index === 0
}

// Usage in component
const dataLayers = computed(() =>
  mapStore.layers.filter((layer, index) => !isBasemapLayer(layer, index))
)
```

**Rationale**:
- Explicit id convention (`basemap-*`) is self-documenting and maintainable
- Position fallback (index 0) provides robustness for legacy layers
- No need to extend MapContextLayer type with custom properties
- Performs well even with many layers (O(n) single pass)

**Alternatives Rejected**:
1. **Add `isBasemap: boolean` to MapContextLayer**: Would require forking geospatial-sdk types
2. **Check `layer.type === 'xyz'`**: Too broad - data layers can also be XYZ
3. **Hardcode layer id check**: Less flexible than prefix pattern

---

### 2. NuxtUI Component Selection

**Question**: Which NuxtUI components should be used for the context menu, trigger button, and empty state?

**NuxtUI Documentation Review**:
- Overlay components: UContextMenu, UDropdownMenu, UPopover, UModal
- Button components: UButton
- Empty states: UEmpty
- Icons: UIcon

**Decisions**:

#### Context Menu: UDropdownMenu

**Why UDropdownMenu over UContextMenu**:
- UDropdownMenu: Designed for button-triggered action menus
- UContextMenu: Designed for right-click context menus
- UDropdownMenu includes positioning, click-outside, keyboard nav out of box

**API Structure**:
```vue
<UDropdownMenu :items="[
  [{ label: 'Delete layer', icon: 'i-heroicons-trash', click: () => deleteLayer(layer.id) }]
]">
  <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" />
</UDropdownMenu>
```

#### Menu Trigger: UButton with Icon

**Configuration**:
- Icon: `i-heroicons-ellipsis-vertical` (three dots vertical)
- Variant: `ghost` (minimal styling)
- Size: `xs` or `sm` (compact for list items)

#### Empty State: UEmpty

**Configuration**:
```vue
<UEmpty
  icon="i-heroicons-queue-list"
  message="No layers added"
  description="Add layers to the map to see them here"
/>
```

**Rationale**: Provides consistent empty state UI with icon, message, and optional description

---

### 3. Layer Ordering and Display

**Question**: How to display layers in reverse stack order (most visible = top of list)?

**MapContext Structure**:
- Layers stored in array where last element = topmost (most visible)
- Visual stacking: `[basemap (index 0), layer1, layer2, layer3 (top)]`
- Display requirement: Show layer3 at top of list

**Decision**: Reverse filtered array before rendering

**Implementation**:
```typescript
const dataLayers = computed(() => {
  const filtered = mapStore.layers.filter((layer, index) => !isBasemapLayer(layer, index))
  return filtered.reverse() // or [...filtered].reverse() to avoid mutation
})
```

**Note**: Use spread operator `[...filtered].reverse()` to avoid mutating computed array

**Rationale**:
- Simple, declarative, leverages Vue reactivity
- `.reverse()` is O(n) - acceptable performance for layer lists (typically < 50 layers)
- Alternative approaches (negative indexing, manual loops) add complexity without benefit

---

### 4. Label Truncation Strategy

**Question**: How to truncate long layer labels while maintaining readability and accessibility?

**Approach Comparison**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| CSS `text-overflow: ellipsis` | Responsive, handles all edge cases, no JS | Requires width constraint | ✅ Recommended |
| JS substring truncation | Full control | Not responsive, complex edge cases | ❌ Rejected |
| Fixed character count | Simple | Ignores container width | ❌ Rejected |

**Decision**: CSS truncation with Tailwind + UTooltip for full label on hover

**Implementation**:
```vue
<template>
  <div v-for="layer in dataLayers" :key="layer.id" class="flex items-center gap-2">
    <UTooltip :text="layer.label">
      <span class="truncate flex-1">{{ layer.label }}</span>
    </UTooltip>
    <UDropdownMenu>...</UDropdownMenu>
  </div>
</template>

<style scoped>
/* Ensure truncate works - parent needs width constraint */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

**Rationale**:
- Tailwind's `truncate` class provides battle-tested CSS truncation
- UTooltip provides accessibility - users can see full label
- Flex layout with `flex-1` ensures label takes available space
- Responsive to container width changes

**Edge Cases Handled**:
- Very long labels (100+ chars): CSS ellipsis handles gracefully
- Special characters/emojis: CSS handles unicode correctly
- Container resizing: Responsive via flex + truncate
- Empty/null labels: Component should handle with fallback "Untitled Layer"

---

### 5. Layer Deletion Pattern

**Question**: How should layer deletion be implemented to maintain immutability and follow MapContext principles?

**Architecture Options**:

1. **Store Action (Recommended)**:
   ```typescript
   // In map.store.ts
   function deleteLayer(layer: MapContextLayer) {
     context.value = removeLayerFromContext(context.value, layer)
   }
   ```

2. **Component-Level Mutation (Rejected)**:
   ```typescript
   // In component - violates separation of concerns
   const deleteLayer = (layerId: string) => {
     mapStore.context = { ...mapStore.context, layers: mapStore.layers.filter(...) }
   }
   ```

3. **Event Emission to Parent (Rejected)**:
   ```typescript
   // Adds unnecessary indirection
   emit('delete-layer', layerId)
   ```

**Decision**: Implement as store action. Use removeLayerFromContext from geospatial-sdk.

**Rationale**:
- **Constitution Principle I**: Keeps all MapContext mutations in store
- **SOLID Single Responsibility**: Store owns MapContext state management
- **Future-Proof**: Enables undo/redo, layer history tracking, side effects (sync to backend)
- **Testability**: Can test store action independently of component

**Implementation Details**:
```typescript
// src/stores/map.store.ts
export const useMapStore = defineStore('map', () => {
  const context: Ref<MapContext> = ref<MapContext>(DEFAULT_MAP_CONTEXT)

  // ... existing code ...

  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value, layer)
  }

  return {
    context,
    layers,
    view,
    setView,
    addLayer,
    deleteLayer, // Export new action
  }
})
```

**Component Usage**:
```typescript
<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'

const mapStore = useMapStore()

const handleDeleteLayer = (layerId: string) => {
  mapStore.deleteLayer(layerId)
}
</script>
```

---

### 6. Vue Reactivity and Performance

**Question**: How to ensure layer list updates automatically when MapContext changes?

**Vue Reactivity Analysis**:
- Pinia store's `ref(context)` is reactive
- Computed properties automatically track dependencies
- Changes to `context.value.layers` trigger component re-render

**Decision**: Use computed property for filtered/reversed layers

**Implementation**:
```typescript
const dataLayers = computed(() => {
  return [...mapStore.layers]
    .filter((layer, index) => !isBasemapLayer(layer, index))
    .reverse()
})
```

**Performance Considerations**:
- Computed properties cache result until dependencies change
- Filter + reverse operations: O(n) - acceptable for layer lists
- No need for manual watchers or refs
- Layer count expectation: 1-50 layers (common GIS use case)

**Testing Note**: Should verify reactivity with:
1. Adding layer → list updates
2. Removing layer → list updates
3. Reordering layers → list updates

---

### 7. Empty State Handling

**Question**: What message and icon to show when no data layers exist?

**UEmpty Component API**:
```typescript
interface UEmptyProps {
  icon?: string        // Heroicon name
  message?: string     // Primary message
  description?: string // Secondary text
}
```

**Decision**:
```vue
<UEmpty
  icon="i-heroicons-queue-list"
  message="No layers added"
  description="Add layers to the map to see them here"
/>
```

**Icon Selection Rationale**:
- `i-heroicons-queue-list`: Represents list/layers visually
- Alternatives considered:
  - `i-heroicons-map`: Too generic
  - `i-heroicons-layers`: Not available in Heroicons v2
  - `i-heroicons-document-plus`: Implies adding documents, not layers

**Message Strategy**:
- Primary: Short, declarative ("No layers added")
- Description: Actionable guidance ("Add layers...")
- Tone: Neutral, not error state

---

## Technology Stack Validation

**Confirmed Dependencies** (from package.json):
- ✅ Vue 3.5.26
- ✅ Pinia 3.0.4
- ✅ NuxtUI 4.3.0
- ✅ @geospatial-sdk/core 0.0.5-dev.44
- ✅ @geospatial-sdk/openlayers 0.0.5-dev.44
- ✅ Tailwind CSS 4.1.18
- ✅ TypeScript 5.9.3

**No Additional Dependencies Required**: All required functionality available in existing stack.

---

## Design Patterns Identified

### 1. Container/Presentational Split (Optional Enhancement)

**Current Design**: Single LayerManager.vue component (monolithic)

**Potential Future Split**:
- `LayerManager.vue`: Container (connects to store, handles actions)
- `LayerList.vue`: Presentational (renders list, emits events)
- `LayerListItem.vue`: Presentational (single layer item)

**Decision for MVP**: Keep as single component
- Estimated ~150-180 lines - within 200 line limit
- Premature abstraction violates constitution principle III
- Can refactor if component grows beyond 200 lines

### 2. Composable Pattern (Optional)

**Potential Composable**:
```typescript
// src/composables/useLayerManagement.ts
export function useLayerManagement() {
  const mapStore = useMapStore()

  const dataLayers = computed(() => /* filtering logic */)

  const deleteLayer = (layerId: string) => mapStore.deleteLayer(layerId)

  const isBasemapLayer = (layer: MapContextLayer, index: number): boolean => {
    return layer.id?.startsWith('basemap-') || index === 0
  }

  return { dataLayers, deleteLayer, isBasemapLayer }
}
```

**Decision for MVP**: Implement logic in component
- Single component uses this logic (no reuse yet)
- Extract to composable if second component needs same logic (rule of three)

---

## Risk Assessment

### Low Risk
- ✅ All required NuxtUI components available
- ✅ MapContext structure well-defined in existing codebase
- ✅ Immutability pattern already used in store

### Medium Risk
- ⚠️ **Label truncation UX**: Need to verify ellipsis works with various label lengths
  - Mitigation: Use UTooltip to show full label on hover
- ⚠️ **Empty state visibility**: Need to ensure empty state is discoverable
  - Mitigation: Use clear messaging and icon

### No Identified High Risks

---

## Open Questions (Resolved)

1. **Q**: Should layer manager be a sidebar component or a floating panel?
   **A**: Implementation detail for integration phase - component is agnostic to placement

2. **Q**: Should there be a confirmation dialog before deleting layers?
   **A**: No - spec doesn't require it, can add in future iteration if users request

3. **Q**: How to handle layers without an id or label?
   **A**: Add defensive checks - default id to layer index, default label to "Untitled Layer"

---

## References

- [NuxtUI Overlay Components](https://ui.nuxt.com/docs/components#overlay)
- [NuxtUI Element Components](https://ui.nuxt.com/docs/components#element)
- [Geospatial SDK Documentation](https://github.com/camptocamp/geospatial-sdk)
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [Pinia Store Documentation](https://pinia.vuejs.org/core-concepts/)

---

**Research Status**: ✅ Complete - All questions resolved, ready for implementation design phase.
