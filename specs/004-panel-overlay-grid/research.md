# Research Findings: Panel Overlay Grid System

**Date**: 2026-01-09 (Updated)
**Feature**: Panel Overlay Grid System
**Branch**: 001-panel-overlay-grid

## Overview

This document consolidates research findings for technical decisions required to implement the panel overlay grid system. Each section addresses a specific unknown from the Technical Context and provides actionable guidance for implementation.

**Key Updates**:
- Use Tailwind CSS utilities for grid layout
- Separate stores for layers (selection) and layout (visibility)
- Store full MapContextLayer object, not just ID
- Components in `components/layout/` folder
- Desktop: 5-column grid, Mobile: single column

---

## 1. Tailwind CSS Grid Layout for Dynamic Panel System

### Decision
Use Tailwind CSS grid utilities with responsive modifiers for desktop (5 columns) and mobile (1 column). Apply dynamic classes based on panel count using Vue computed properties.

### Implementation Approach

**Tailwind Grid Classes**:
```vue
<template>
  <!-- Mobile: single column, Desktop: dynamic grid -->
  <div :class="[
    'grid gap-0 h-screen absolute top-0 left-0 pointer-events-none z-20',
    'grid-cols-1',              // Mobile: always 1 column
    gridClassDesktop            // Desktop: dynamic (1-5 columns)
  ]">
    <!-- Panels here -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutState } from '@/composables/useLayoutState'

const { activePanelCount } = useLayoutState()

const gridClassDesktop = computed(() => {
  const gridClasses = {
    1: 'md:grid-cols-[28rem]',
    2: 'md:grid-cols-[28rem_28rem]',
    3: 'md:grid-cols-[28rem_28rem_28rem]',
    4: 'md:grid-cols-[28rem_28rem_28rem_28rem]',
    5: 'md:grid-cols-[28rem_28rem_28rem_28rem_28rem]'
  }
  return gridClasses[activePanelCount.value as keyof typeof gridClasses]
})
</script>
```

**Why Arbitrary Values (`[28rem]`)**:
- Tailwind `w-110` = 110 * 0.25rem = 27.5rem
- Use `[28rem]` for cleaner grid template (Tailwind arbitrary value syntax)
- `md:` prefix applies grid only on desktop (≥768px breakpoint)
- Mobile gets single column by default (`grid-cols-1`)

**Responsive Behavior**:
```css
/* Mobile (< 768px): Single column, panels stack vertically */
.grid.grid-cols-1 {
  grid-template-columns: 1fr; /* Full width */
}

/* Desktop (≥ 768px): Multi-column grid */
@media (min-width: 768px) {
  .md\:grid-cols-\[28rem_28rem\] {
    grid-template-columns: 28rem 28rem;
  }
}
```

**Panel Container**:
```css
.panel-grid {
  pointer-events: none; /* Map interactions pass through */
}

.panel-grid > * {
  pointer-events: auto; /* Panels capture interactions */
}
```

### Smooth Transitions

Animate panel content, not grid structure:

```css
/* Panel transition */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
}

.panel-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.panel-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
```

### Mobile Considerations

**Mobile Panel Behavior**:
- Single column layout (panels stack vertically)
- Full viewport width panels
- Scroll vertically to access stacked panels
- Consider drawer/modal pattern for layer details on mobile

**Alternative Mobile Pattern**:
```vue
<!-- Mobile: Use UDrawer for details instead of stacking -->
<template>
  <div class="md:hidden">
    <LayerPanel />
    <UDrawer v-model="isDetailsOpen">
      <LayerDetailsPanel :layer="selectedLayer" />
    </UDrawer>
  </div>

  <div class="hidden md:grid" :class="gridClassDesktop">
    <LayerPanel />
    <LayerDetailsPanel v-if="selectedLayer" :layer="selectedLayer" />
  </div>
</template>
```

### Rationale
- **Tailwind utilities**: No custom CSS, maintainable, consistent with Tailwind conventions
- **Arbitrary values**: Precise column widths matching design (28rem)
- **Responsive modifiers**: Built-in mobile/desktop breakpoints
- **Mobile-first**: Default single column, progressive enhancement for desktop
- **Performance**: Class-based approach is more performant than inline styles

### Alternatives Considered
- **Custom CSS Grid**: Less maintainable, doesn't leverage Tailwind
- **Flexbox**: More complex for equal-width columns
- **Fixed desktop-only**: Poor mobile UX, doesn't meet responsive requirement

---

## 2. NuxtUI Tabs Component Integration

### Decision
Use `<UTabs>` component with uncontrolled mode. Identical to previous research - no changes needed.

### Implementation (Unchanged)

```vue
<template>
  <UTabs :items="tabItems" default-value="layers">
    <template #layers>
      <LayerManager @select-layer="handleLayerSelect" />
    </template>
    <template #tree>
      <div class="p-4 text-center text-gray-500">
        Tree view coming soon
      </div>
    </template>
  </UTabs>
</template>

<script setup lang="ts">
const tabItems = [
  { value: 'layers', label: 'Layers' },
  { value: 'tree', label: 'Tree' }
]

const handleLayerSelect = (layer: MapContextLayer) => {
  // Updated: pass full layer object to store
  layersStore.selectLayer(layer)
}
</script>
```

---

## 3. Separate Store Architecture (Layers + Layout)

### Decision
Create two separate Pinia stores: `layers.store.ts` for layer selection and `layout.store.ts` for panel visibility. Stores communicate via reactivity (layout store watches layers store).

### Layer Selection Store

**File**: `src/stores/layers.store.ts`

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MapContextLayer } from '@geospatial-sdk/core'

export const useLayersStore = defineStore('layers', () => {
  // Store full layer object, not just ID
  const selectedLayer = ref<MapContextLayer | null>(null)

  const hasSelection = computed(() => selectedLayer.value !== null)

  const selectLayer = (layer: MapContextLayer) => {
    // Toggle: clicking same layer deselects it
    if (selectedLayer.value?.id === layer.id) {
      selectedLayer.value = null
    } else {
      selectedLayer.value = layer
    }
  }

  const deselectLayer = () => {
    selectedLayer.value = null
  }

  return {
    selectedLayer,
    hasSelection,
    selectLayer,
    deselectLayer
  }
})
```

**Key Design**:
- `selectedLayer` is `ref<MapContextLayer | null>` (full object, not ID)
- Toggle logic built into `selectLayer()`
- `hasSelection` computed for convenience

### Layout/Panel Visibility Store

**File**: `src/stores/layout.store.ts`

```typescript
import { computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useLayersStore } from './layers.store'

export const useLayoutStore = defineStore('layout', () => {
  const layersStore = useLayersStore()
  const { selectedLayer } = storeToRefs(layersStore)

  // Derived state: panel visibility based on layer selection
  const isDetailsVisible = computed(() => selectedLayer.value !== null)

  const activePanelCount = computed<1 | 2 | 3 | 4 | 5>(() => {
    return isDetailsVisible.value ? 2 : 1
  })

  return {
    isDetailsVisible,
    activePanelCount
  }
})
```

**Key Design**:
- Imports and watches `selectedLayer` from layers store
- All panel visibility is derived/computed from layer selection
- No local state - pure reactive transformations
- Extensible for future panels (3-5)

### Store Communication Pattern

```
User clicks layer
  ↓
LayerManager emits: selectLayer(layer)
  ↓
Component calls: layersStore.selectLayer(layer)
  ↓
layers.store: selectedLayer.value = layer
  ↓
[Reactivity propagation]
  ↓
layout.store computed properties re-run:
  - isDetailsVisible → true
  - activePanelCount → 2
  ↓
Components using layoutStore see updates
  ↓
LayoutGrid re-renders with new grid class
```

### Rationale
- **Separation of Concerns**: Layer state separate from UI layout state
- **Single Responsibility**: Each store manages one domain
- **Loose Coupling**: Stores communicate via reactivity, not direct calls
- **Testability**: Each store can be tested independently
- **Scalability**: Easy to add more stores (e.g., `search.store.ts`) that react to layer selection

### Alternatives Considered
- **Single combined store**: Violates single responsibility, harder to test
- **Props drilling**: Complex, loses reactivity benefits
- **Event bus**: Over-engineered, harder to debug than reactive stores

---

## 4. Panel Transition Performance

### Decision
Unchanged from previous research - use CSS transforms with hardware acceleration.

### Implementation (Unchanged)

```css
.panel {
  transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
  will-change: transform, opacity;
}

.panel-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.panel-enter-to {
  opacity: 1;
  transform: translateX(0);
}
```

---

## 5. Layer Details Panel Content

### Decision
Unchanged from previous research - display MapContextLayer properties using NuxtUI components.

### Implementation (Unchanged)

Display: type, visibility, opacity, zoom range, attribution, metadata. Use `UEmpty` for fallback when no details available.

---

## 6. Responsive Behavior (Desktop vs Mobile)

### Decision
Use Tailwind `md:` breakpoint (768px) to switch between mobile (single column) and desktop (grid). Mobile uses vertical stacking or drawer pattern for details panel.

### Breakpoint Strategy

**Tailwind Default Breakpoints**:
- `sm`: 640px
- `md`: 768px ← Use this
- `lg`: 1024px
- `xl`: 1280px

**Why `md:` (768px)**:
- Tablets in portrait mode get mobile experience (simpler)
- Tablets in landscape + desktop get grid experience
- Aligns with common mobile/desktop distinction

### Mobile Implementation Options

**Option A: Vertical Stack**
```vue
<template>
  <!-- Mobile: panels stack vertically -->
  <div class="grid grid-cols-1 md:grid-cols-[28rem_28rem]">
    <LayerPanel />
    <LayerDetailsPanel v-if="selectedLayer" :layer="selectedLayer" />
  </div>
</template>
```

**Option B: Drawer for Details (Recommended)**
```vue
<template>
  <!-- Mobile: drawer for details -->
  <div class="md:hidden">
    <LayerPanel />
  </div>

  <UDrawer v-model="isDetailsOpen" :ui="{ width: 'w-full' }">
    <LayerDetailsPanel v-if="selectedLayer" :layer="selectedLayer" />
  </UDrawer>

  <!-- Desktop: grid layout -->
  <div class="hidden md:grid" :class="gridClassDesktop">
    <LayerPanel />
    <LayerDetailsPanel v-if="selectedLayer" :layer="selectedLayer" />
  </div>
</template>

<script setup lang="ts">
const { selectedLayer } = useLayersStore()
const isDetailsOpen = computed({
  get: () => selectedLayer.value !== null,
  set: (value) => {
    if (!value) deselectLayer()
  }
})
</script>
```

**Recommendation**: Use **Option B (Drawer)** for mobile:
- Better mobile UX (full-screen details)
- Avoids vertical scroll competition between map and panels
- Native mobile feel (swipe to dismiss)
- NuxtUI `<UDrawer>` handles touch gestures automatically

### Touch Interactions

Mobile-specific considerations:
- Larger touch targets (44x44px minimum)
- Swipe to close drawer
- No hover states (use `:active` instead)
- Consider bottom sheet pattern for layer panel

### Rationale
- `md:` breakpoint is industry standard for mobile/desktop split
- Drawer pattern is native mobile UX for details views
- Vertical stacking causes scroll conflicts with map
- Responsive modifiers keep code clean (no JS media queries)

---

## Summary of Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Grid Layout** | Tailwind utilities with arbitrary values | Maintainable, responsive, no custom CSS |
| **Mobile Layout** | Single column + drawer for details | Better mobile UX, native feel |
| **Desktop Layout** | 5-column grid with dynamic classes | Flexible, clean responsive code |
| **Tabs** | NuxtUI `<UTabs>` uncontrolled | Constitution compliant, accessible |
| **Layer Store** | `layers.store.ts` with full MapContextLayer | No ID lookups, direct object access |
| **Layout Store** | `layout.store.ts` derived from layers store | Separation of concerns, reactive |
| **Store Communication** | Pinia store refs + computed | Loose coupling, testable |
| **Transitions** | CSS transforms + opacity (150ms) | GPU-accelerated, smooth |
| **Breakpoint** | `md:` (768px) | Industry standard, tablet-friendly |
| **Component Folder** | `components/layout/` | Clear domain naming |

---

## Open Questions Resolved

All technical unknowns from the plan have been researched and resolved:

✅ Tailwind CSS grid layout approach defined
✅ Mobile vs desktop responsive strategy decided
✅ Separate store architecture with communication pattern
✅ NuxtUI Tabs integration (unchanged)
✅ Performance optimization strategy documented
✅ Layer details content specification complete

**Status**: Ready for Phase 1 (Design Artifacts)
