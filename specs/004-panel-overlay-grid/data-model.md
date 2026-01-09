# Data Model: Panel Overlay Grid System

**Date**: 2026-01-09
**Feature**: Panel Overlay Grid System
**Branch**: 001-panel-overlay-grid

## Overview

This document defines the data structures and state shape for the panel overlay grid system. All interfaces follow TypeScript strict mode conventions and leverage existing geospatial-sdk types where applicable.

---

## State Architecture

### State Location

```
┌─────────────────────────────────────────┐
│         Pinia Store (map.store.ts)      │
│  ┌────────────────────────────────────┐ │
│  │ context: Ref<MapContext>           │ │ ← Existing
│  │ selectedLayerId: Ref<string|null>  │ │ ← NEW
│  │ selectedLayer: ComputedRef         │ │ ← NEW (computed)
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Composable (usePanelState.ts)         │
│  ┌────────────────────────────────────┐ │
│  │ isDetailsVisible: ComputedRef      │ │ ← Derived from store
│  │ activePanelCount: ComputedRef      │ │ ← Derived from store
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│       Components (PanelGrid.vue)        │
│  Use composable for reactivity          │
└─────────────────────────────────────────┘
```

---

## Core Data Structures

### 1. Layer Selection State

Represents which layer (if any) is currently selected by the user.

```typescript
interface LayerSelectionState {
  /**
   * ID of the currently selected layer from MapContext.
   * Null when no layer is selected.
   */
  selectedLayerId: string | null

  /**
   * Computed: The full layer object for the selected layer.
   * Null when no layer is selected or layer not found.
   */
  selectedLayer: MapContextLayer | null
}
```

**Source**: Pinia store (`map.store.ts`)
**Mutators**: `selectLayer(layerId: string)`, `deselectLayer()`
**Reactivity**: `ref` for `selectedLayerId`, `computed` for `selectedLayer`

### 2. Panel Visibility State

Derived state determining which panels are visible in the grid.

```typescript
interface PanelVisibilityState {
  /**
   * Whether the layer details panel is visible.
   * True when a layer is selected.
   */
  isDetailsVisible: boolean

  /**
   * Number of active panels (1-5).
   * Currently: 1 (Layer Panel) or 2 (Layer Panel + Details Panel)
   * Future: up to 5 as new panel types are added
   */
  activePanelCount: 1 | 2 | 3 | 4 | 5
}
```

**Source**: Composable (`usePanelState.ts`)
**Computation**:
```typescript
const isDetailsVisible = computed(() => selectedLayerId.value !== null)
const activePanelCount = computed(() => isDetailsVisible.value ? 2 : 1)
```

### 3. Grid Configuration

Configuration for CSS Grid layout based on active panels.

```typescript
interface GridConfig {
  /**
   * CSS class name for grid-template-columns configuration.
   * Maps to Tailwind/custom CSS classes defining column counts.
   */
  gridClass: 'grid-1-col' | 'grid-2-col' | 'grid-3-col' | 'grid-4-col' | 'grid-5-col'

  /**
   * Array of panel configurations, one per visible panel.
   * Order determines grid column placement (left to right).
   */
  panels: PanelConfig[]
}

interface PanelConfig {
  /**
   * Unique identifier for this panel type.
   * Used for keying in v-for loops and debugging.
   */
  id: string

  /**
   * Panel type discriminator.
   * Determines which component to render.
   */
  type: 'layer-panel' | 'layer-details' | 'future-panel-type'

  /**
   * Whether this panel is currently visible.
   * All panels in GridConfig.panels array should be visible.
   */
  visible: boolean

  /**
   * Props to pass to the panel component.
   * Type varies based on panel type.
   */
  props?: Record<string, unknown>
}
```

**Source**: Computed in `PanelGrid.vue`
**Example**:
```typescript
const gridConfig = computed<GridConfig>(() => {
  const panels: PanelConfig[] = [
    {
      id: 'layer-panel',
      type: 'layer-panel',
      visible: true,
      props: {}
    }
  ]

  if (isDetailsVisible.value && selectedLayer.value) {
    panels.push({
      id: 'layer-details',
      type: 'layer-details',
      visible: true,
      props: {
        layer: selectedLayer.value
      }
    })
  }

  return {
    gridClass: `grid-${panels.length}-col`,
    panels
  }
})
```

---

## Component Props & Emits

### PanelGrid Component

**Props**: None (uses composable for state)

**Emits**: None

**Consumed State**:
```typescript
const { isDetailsVisible, activePanelCount, selectedLayer } = usePanelState()
```

---

### LayerPanel Component

**Props**: None

**Emits**:
```typescript
interface LayerPanelEmits {
  /**
   * Emitted when a layer is selected/clicked by the user.
   * @param layerId - The ID of the selected layer
   */
  selectLayer: [layerId: string]
}
```

**Internal State**:
```typescript
// Active tab: 'layers' | 'tree'
// Managed by UTabs component (uncontrolled)
```

---

### LayerDetailsPanel Component

**Props**:
```typescript
interface LayerDetailsPanelProps {
  /**
   * The layer to display details for.
   * Required prop, always provided when panel is visible.
   */
  layer: MapContextLayer
}
```

**Emits**:
```typescript
interface LayerDetailsPanelEmits {
  /**
   * Emitted when the close button is clicked.
   * Parent should call deselectLayer() in response.
   */
  close: []
}
```

---

### LayerManager Component (Modified)

**Props**: Unchanged (no props)

**Emits** (NEW):
```typescript
interface LayerManagerEmits {
  /**
   * Emitted when a layer item is clicked.
   * @param layer - The full layer object that was clicked
   */
  selectLayer: [layer: MapContextLayer]
}
```

---

## State Transitions

### Selecting a Layer

```
User clicks layer in LayerManager
  ↓
LayerManager emits: selectLayer(layer)
  ↓
LayerPanel receives event, extracts layer.id
  ↓
Calls: mapStore.selectLayer(layer.id)
  ↓
Store updates: selectedLayerId.value = layer.id
  ↓
Computed updates:
  - selectedLayer computed re-runs → finds layer in context.layers
  - isDetailsVisible computed re-runs → returns true
  - activePanelCount computed re-runs → returns 2
  ↓
PanelGrid re-renders:
  - gridConfig computed re-runs
  - Adds LayerDetailsPanel to panels array
  - Updates gridClass to 'grid-2-col'
  ↓
Vue Transition: panel-enter animation
  ↓
LayerDetailsPanel visible with layer details
```

### Deselecting a Layer (Toggle)

```
User clicks same layer again
  ↓
LayerManager emits: selectLayer(layer)
  ↓
LayerPanel calls: mapStore.selectLayer(layer.id)
  ↓
Store logic: selectedLayerId === layer.id → set to null
  ↓
Computed updates:
  - selectedLayer → null
  - isDetailsVisible → false
  - activePanelCount → 1
  ↓
PanelGrid re-renders:
  - Removes LayerDetailsPanel from panels array
  - Updates gridClass to 'grid-1-col'
  ↓
Vue Transition: panel-leave animation
  ↓
LayerDetailsPanel removed from DOM
```

### Switching Selected Layer

```
User clicks different layer (layer A selected, clicks layer B)
  ↓
LayerManager emits: selectLayer(layerB)
  ↓
Store updates: selectedLayerId.value = layerB.id
  ↓
Computed updates:
  - selectedLayer → finds layerB in context.layers
  - isDetailsVisible → remains true
  - activePanelCount → remains 2
  ↓
PanelGrid re-renders:
  - gridConfig.panels[1].props.layer updates to layerB
  - gridClass unchanged ('grid-2-col')
  ↓
LayerDetailsPanel receives new layer prop
  ↓
Component re-renders with new layer details
```

---

## Validation Rules

### Layer Selection

1. **Valid Layer ID**: `selectedLayerId` must reference an existing layer in `context.layers` or be `null`
2. **Single Selection**: Only one layer can be selected at a time
3. **Toggle Behavior**: Selecting the same layer twice deselects it

### Panel Visibility

1. **Layer Panel Always Visible**: Cannot be hidden (permanent first panel)
2. **Details Panel Conditional**: Only visible when `selectedLayerId !== null`
3. **Max 5 Panels**: Grid supports up to 5 panels (future-proofing)

### Grid Configuration

1. **Panel Order**: Panels array order determines grid column placement
2. **Grid Class Sync**: `gridClass` must match `panels.length`
3. **Visible Panels Only**: Only visible panels included in `panels` array

---

## Type Imports

All types depend on these imports:

```typescript
// geospatial-sdk types
import type { MapContext, MapContextLayer } from '@geospatial-sdk/core'

// Vue types
import type { Ref, ComputedRef } from 'vue'

// Local types
import type {
  LayerSelectionState,
  PanelVisibilityState,
  GridConfig,
  PanelConfig
} from '@/types/panel'
```

---

## Immutability Patterns

All state mutations follow Vue 3 / Pinia immutability conventions:

```typescript
// ✅ CORRECT - ref assignment
selectedLayerId.value = newLayerId

// ✅ CORRECT - computed returns new object
const gridConfig = computed(() => ({
  gridClass: `grid-${count}-col`,
  panels: [...] // new array
}))

// ❌ WRONG - direct mutation
selectedLayerId = newLayerId // Missing .value

// ❌ WRONG - mutating computed
gridConfig.value.panels.push(newPanel)
```

---

## Future Extensions

This data model is designed to accommodate future panel types:

**Adding a 3rd Panel Type** (e.g., "Search Results Panel"):
1. Add new `type` value to `PanelConfig['type']` union
2. Add new computed logic in `PanelGrid` to determine visibility
3. Add panel config to `panels` array when visible
4. Update `gridClass` computation to handle 3+ panels
5. No changes needed to existing layer selection logic

**Example**:
```typescript
type PanelType = 'layer-panel' | 'layer-details' | 'search-results'

const gridConfig = computed(() => {
  const panels = [layerPanel]
  if (isDetailsVisible.value) panels.push(detailsPanel)
  if (isSearchActive.value) panels.push(searchPanel)
  return { gridClass: `grid-${panels.length}-col`, panels }
})
```

---

## Summary

| Entity | Type | Source | Mutability |
|--------|------|--------|------------|
| `selectedLayerId` | `Ref<string\|null>` | Pinia store | Mutable via actions |
| `selectedLayer` | `ComputedRef<MapContextLayer\|null>` | Pinia store | Read-only (derived) |
| `isDetailsVisible` | `ComputedRef<boolean>` | Composable | Read-only (derived) |
| `activePanelCount` | `ComputedRef<1\|2\|3\|4\|5>` | Composable | Read-only (derived) |
| `gridConfig` | `ComputedRef<GridConfig>` | PanelGrid component | Read-only (derived) |

**Status**: Data model complete, ready for contracts generation
