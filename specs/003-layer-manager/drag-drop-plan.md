# Implementation Plan: Drag-and-Drop Layer Reordering

**Feature**: Layer Manager - Drag & Drop Reordering
**Branch**: `003-layer-manager`
**Date**: 2026-01-08
**Status**: ✅ Implemented

## Overview

Add drag-and-drop functionality to the Layer Manager to allow users to reorder layers by dragging the stack2 icon. Uses VueUse's `useSortable` with SortableJS for smooth animations and visual feedback.

## User Requirements

- Drag layers to reorder them in the list
- Only the stack2 icon acts as drag handle (not entire row)
- Visual feedback: drag preview/ghost, drop zone indicator, smooth animations
- Reordering updates MapContext layer array in store
- Basemap (index 0) never moves

## Technical Challenge: Visual vs MapContext Index Mapping

**Critical Detail:**
- Display array is REVERSED: `computed(() => layers.filter(...).reverse())`
- Visual order: [layer-C, layer-B, layer-A] (C is topmost, shown first)
- MapContext order: [basemap, layer-A, layer-B, layer-C] (C is at highest index)

**Solution:**
Use geospatial-sdk's `changeLayerPositionInContext()` utility with delta calculation:
```typescript
const delta = oldIndex - newIndex
const draggedLayer = dataLayers.value[oldIndex]
mapStore.changeLayerPosition(draggedLayer, delta)
```

The SDK handles the reversal mapping internally.

## Dependencies

**Installed:**
```bash
npm install sortablejs @types/sortablejs
```

**Constitution Justification:**
- Problem: Drag-and-drop UX requires DOM manipulation, animations, touch support
- NuxtUI has no drag-and-drop component
- Custom implementation would violate clean code (100+ lines)
- SortableJS: 15KB minified+gzipped, battle-tested, stable API
- VueUse provides type-safe integration wrapper

## Implementation Summary

### 1. Created: `src/composables/useLayerReordering.ts`

Core drag-and-drop logic with delta-based positioning.

```typescript
export function useLayerReordering(dataLayers: ComputedRef<MapContextLayer[]>) {
  const mapStore = useMapStore()
  const sortableRef = ref<HTMLElement | null>(null)
  const isDragging = ref(false)

  const handleReorder = (oldIndex: number, newIndex: number): void => {
    if (oldIndex === newIndex) return

    const delta = oldIndex - newIndex
    const draggedLayer = dataLayers.value[oldIndex]
    if (!draggedLayer) return

    mapStore.changeLayerPosition(draggedLayer, delta)
  }

  useSortable(sortableRef, dataLayers, {
    animation: 200,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onStart: () => isDragging.value = true,
    onEnd: (evt) => {
      isDragging.value = false
      if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
        handleReorder(evt.oldIndex, evt.newIndex)
      }
    }
  })

  return { sortableRef, isDragging }
}
```

**Key Points:**
- Delta calculation: `oldIndex - newIndex`
- Positive delta = move up (higher z-order)
- Negative delta = move down (lower z-order)
- SDK handles array index reversal internally

### 2. Modified: `src/stores/map.store.ts`

Added `changeLayerPosition` action using geospatial-sdk utilities.

```typescript
import { changeLayerPositionInContext, getLayerPosition } from '@geospatial-sdk/core'

function changeLayerPosition(layer: MapContextLayer, delta: number) {
  const oldPosition = getLayerPosition(context.value, layer)
  const newPosition = oldPosition + delta
  context.value = changeLayerPositionInContext(context.value, layer, newPosition)
}

return {
  context,
  layers,
  view,
  setView,
  addLayer,
  deleteLayer,
  changeLayerPosition,  // NEW
}
```

**Benefits:**
- Uses SDK utilities (proper architecture)
- Immutable updates maintained
- Handles edge cases (bounds checking)
- Basemap protection built-in

### 3. Modified: `src/composables/useLayerManagement.ts`

Integrated reordering composable.

```typescript
import { useLayerReordering } from './useLayerReordering'

export function useLayerManagement() {
  const mapStore = useMapStore()

  const dataLayers: ComputedRef<MapContextLayer[]> = computed(() => {
    const filtered = mapStore.layers.filter((layer) => !isBasemapLayer(layer))
    return [...filtered].reverse()
  })

  const { sortableRef, isDragging } = useLayerReordering(dataLayers)

  // ... existing functions ...

  return {
    dataLayers,
    handleDeleteLayer,
    getMenuItems,
    getLabel,
    sortableRef,    // NEW
    isDragging,     // NEW
  }
}
```

### 4. Modified: `src/components/layer-manager/LayerManager.vue`

Added sortable container, drag handle, and visual feedback styles.

**Script:**
```vue
<script setup lang="ts">
import { useLayerManagement } from '@/composables/useLayerManagement'

const { dataLayers, getMenuItems, getLabel, sortableRef } = useLayerManagement()
</script>
```

**Template:**
```vue
<div v-else ref="sortableRef" class="layer-list">
  <div
    v-for="(layer, index) in dataLayers"
    :key="layer.id || `layer-${index}`"
    class="layer-item flex items-center gap-2 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
  >
    <UIcon
      name="i-tabler-stack-2"
      class="drag-handle cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    />
    <UTooltip :text="getLabel(layer)">
      <span class="flex-1 truncate text-sm">
        {{ getLabel(layer) }}
      </span>
    </UTooltip>
    <UDropdownMenu :items="getMenuItems(layer)">
      <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="xs" />
    </UDropdownMenu>
  </div>
</div>
```

**Styles:**
```vue
<style scoped>
.layer-manager {
  min-height: 200px;
}

.drag-handle {
  touch-action: none;
}

:deep(.sortable-ghost) {
  opacity: 0.4;
  background-color: rgb(59 130 246 / 0.1);
  border: 2px dashed rgb(59 130 246 / 0.5);
}

:deep(.sortable-drag) {
  opacity: 0.8;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.layer-item {
  transition: transform 0.2s ease;
}
</style>
```

## Visual Feedback Details

### Drag Preview (Ghost)
- 40% opacity
- Light blue background with dashed border
- Indicates original position during drag

### Dragging Element
- 80% opacity
- Box shadow for elevation
- Follows cursor with animation

### Smooth Animations
- 200ms transition for layer reordering
- CSS transform for GPU acceleration

### Cursor
- `cursor-move` on drag handle (stack2 icon)
- Default cursor on other layer elements
- Touch action disabled on handle for mobile support

## Testing Checklist

Manual testing performed:

- ✅ Only stack2 icon triggers drag (not label/menu button)
- ✅ Ghost preview (semi-transparent) shows during drag
- ✅ Smooth animation (200ms) when layers reorder
- ✅ Basemap never moves
- ✅ Layer z-order updates on map immediately
- ✅ Works in light and dark mode
- ✅ Touch devices supported (touch-action: none)

## Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MapContext Source | ✅ | All updates via store action with SDK utilities |
| II. Vue Best Practices | ✅ | Composition API, <script setup> |
| III. Clean Code | ✅ | Functions under 20 lines |
| IV. Component Architecture | ✅ | Logic in composable, component under 200 lines |
| V. TypeScript-First | ✅ | Full type safety, no `any` |
| VI. Geospatial-SDK | ✅ | Uses changeLayerPositionInContext, getLayerPosition |
| VII. Craftsmanship | ✅ | Immutable updates, edge case guards |
| VIII. NuxtUI Standard | ✅ | Uses UIcon, UTooltip, UButton, UDropdownMenu |
| IX. Minimal Comments | ✅ | Self-documenting names, no task references |

## Edge Cases Handled

- Drag to same position: Guard returns early (no-op)
- Missing layer: Type guard checks `draggedLayer` exists
- Out of bounds: SDK utilities handle bounds checking
- Basemap protection: Built into SDK's changeLayerPositionInContext
- Single layer: Works but no visible change
- Empty list: Shows UEmpty, no sortable rendered

## Performance Considerations

1. **Delta Calculation**: O(1) operation, efficient
2. **SDK Utilities**: Optimized immutable updates with spread operators
3. **Reactivity**: Only triggers re-render on actual position change
4. **DOM Manipulation**: SortableJS uses efficient DOM swapping
5. **Bundle Size**: +15KB (SortableJS), minimal impact
6. **Animation**: CSS transitions use GPU acceleration

## Architecture Benefits

Using geospatial-sdk utilities provides:
- **Consistency**: Same pattern across all layer operations
- **Correctness**: SDK handles edge cases (bounds, basemap, reversal)
- **Maintainability**: Less custom code to maintain
- **Future-proof**: SDK updates automatically improve functionality

## Files Modified

**Created:**
- `src/composables/useLayerReordering.ts`

**Modified:**
- `src/stores/map.store.ts`
- `src/composables/useLayerManagement.ts`
- `src/components/layer-manager/LayerManager.vue`
- `package.json` (sortablejs dependency)
- `package-lock.json`

## Commit

```
d938c3c feat: add drag-and-drop layer reordering in layer manager

Enable users to reorder map layers by dragging the stack icon in the layer list.
Reordering updates MapContext immediately, affecting layer z-order on the map.
```

## Future Enhancements (Out of Scope)

1. Undo/redo for layer reordering
2. Multi-select drag (reorder multiple layers at once)
3. Drag between different layer groups/categories
4. Keyboard accessibility (arrow keys to reorder)
5. Persistent layer order preferences

---

**Implementation Date**: 2026-01-08
**Status**: ✅ Complete and committed
