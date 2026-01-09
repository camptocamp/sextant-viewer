# Quickstart Guide: Panel Overlay Grid System

**Date**: 2026-01-09
**Feature**: Panel Overlay Grid System
**Branch**: 001-panel-overlay-grid

## Overview

This guide provides practical examples for using the panel overlay grid system. It covers common use cases, component integration, and state management patterns.

---

## Installation & Setup

### 1. Import Types

```typescript
// src/types/panel.ts
export * from '../specs/001-panel-overlay-grid/contracts/panel-state'
```

### 2. Update Map Store

Add layer selection state to your Pinia store:

```typescript
// src/stores/map.store.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MapContext, MapContextLayer } from '@geospatial-sdk/core'

export const useMapStore = defineStore('map', () => {
  // Existing state
  const context = ref<MapContext>(DEFAULT_MAP_CONTEXT)

  // NEW: Layer selection state
  const selectedLayerId = ref<string | null>(null)

  // NEW: Computed selected layer
  const selectedLayer = computed(() => {
    if (!selectedLayerId.value) return null
    return context.value.layers.find(l => l.id === selectedLayerId.value) || null
  })

  // NEW: Actions
  const selectLayer = (layerId: string) => {
    // Toggle: clicking same layer deselects it
    selectedLayerId.value = layerId === selectedLayerId.value ? null : layerId
  }

  const deselectLayer = () => {
    selectedLayerId.value = null
  }

  return {
    context,
    selectedLayerId,
    selectedLayer,
    selectLayer,
    deselectLayer
  }
})
```

### 3. Create Panel State Composable

```typescript
// src/composables/usePanelState.ts
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { UsePanelStateReturn } from '@/types/panel'

export const usePanelState = (): UsePanelStateReturn => {
  const mapStore = useMapStore()

  const isDetailsVisible = computed(() => mapStore.selectedLayerId !== null)
  const activePanelCount = computed(() => (isDetailsVisible.value ? 2 : 1))

  return {
    isDetailsVisible,
    activePanelCount,
    selectedLayer: mapStore.selectedLayer,
    selectLayer: mapStore.selectLayer,
    deselectLayer: mapStore.deselectLayer
  }
}
```

---

## Basic Usage

### Using PanelGrid in App.vue

Replace the hardcoded panel div with the PanelGrid component:

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import PanelGrid from '@/components/panel/PanelGrid.vue'
import MapViewer from '@/components/map/MapViewer.vue'
</script>

<template>
  <UApp class="relative">
    <MapViewer />
    <PanelGrid />
  </UApp>
</template>
```

### PanelGrid Component

The grid container manages layout and panel visibility:

```vue
<!-- src/components/panel/PanelGrid.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { usePanelState } from '@/composables/usePanelState'
import LayerPanel from './LayerPanel.vue'
import LayerDetailsPanel from './LayerDetailsPanel.vue'
import type { GridConfig } from '@/types/panel'

const { isDetailsVisible, selectedLayer } = usePanelState()

const gridConfig = computed<GridConfig>(() => {
  const panels = [
    {
      id: 'layer-panel',
      type: 'layer-panel' as const,
      visible: true,
      props: {}
    }
  ]

  if (isDetailsVisible.value && selectedLayer.value) {
    panels.push({
      id: 'layer-details',
      type: 'layer-details' as const,
      visible: true,
      props: { layer: selectedLayer.value }
    })
  }

  return {
    gridClass: `grid-${panels.length}-col` as const,
    panels
  }
})
</script>

<template>
  <div :class="['panel-grid absolute top-0 left-0 h-screen pointer-events-none z-20', gridConfig.gridClass]">
    <LayerPanel />

    <Transition name="panel" mode="out-in">
      <LayerDetailsPanel
        v-if="isDetailsVisible && selectedLayer"
        :key="selectedLayer.id"
        :layer="selectedLayer"
      />
    </Transition>
  </div>
</template>

<style scoped>
.panel-grid {
  display: grid;
  gap: 0;
}

.panel-grid > * {
  pointer-events: auto;
}

/* Grid column definitions */
.grid-1-col { grid-template-columns: 28rem; }
.grid-2-col { grid-template-columns: 28rem 28rem; }
.grid-3-col { grid-template-columns: 28rem 28rem 28rem; }
.grid-4-col { grid-template-columns: 28rem 28rem 28rem 28rem; }
.grid-5-col { grid-template-columns: 28rem 28rem 28rem 28rem 28rem; }

/* Panel transition animations */
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
</style>
```

---

## Component Examples

### LayerPanel (Tabbed Interface)

```vue
<!-- src/components/panel/LayerPanel.vue -->
<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import LayerManager from '@/components/layer-manager/LayerManager.vue'
import type { MapContextLayer } from '@geospatial-sdk/core'

const mapStore = useMapStore()

const tabItems = [
  { value: 'layers', label: 'Layers' },
  { value: 'tree', label: 'Tree' }
]

const handleLayerSelect = (layer: MapContextLayer) => {
  mapStore.selectLayer(layer.id)
}
</script>

<template>
  <UCard class="w-110 h-screen overflow-hidden">
    <UTabs :items="tabItems" default-value="layers">
      <template #layers>
        <LayerManager @select-layer="handleLayerSelect" />
      </template>

      <template #tree>
        <div class="p-4 text-center text-gray-500">
          <UIcon name="i-heroicons-rectangle-group" class="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Tree view coming soon</p>
        </div>
      </template>
    </UTabs>
  </UCard>
</template>
```

### LayerDetailsPanel

```vue
<!-- src/components/panel/LayerDetailsPanel.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { LayerDetailsPanelProps } from '@/types/panel'

const props = defineProps<LayerDetailsPanelProps>()
const mapStore = useMapStore()

const hasDetails = computed(() => {
  return Boolean(
    props.layer.minZoom !== undefined ||
    props.layer.maxZoom !== undefined ||
    props.layer.attribution ||
    (props.layer.metadata && Object.keys(props.layer.metadata).length > 0)
  )
})

const formatMetadataValue = (value: unknown): string => {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

const handleClose = () => {
  mapStore.deselectLayer()
}
</script>

<template>
  <UCard class="w-110 h-screen overflow-y-auto">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold truncate">
          {{ layer.label || layer.id }}
        </h3>
        <UButton
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="sm"
          @click="handleClose"
        />
      </div>
    </template>

    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
        <UBadge :label="layer.type" class="mt-1" />
      </div>

      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label>
        <div class="mt-1 flex items-center gap-2">
          <UIcon :name="layer.visible ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'" />
          <span class="text-sm">{{ layer.visible ? 'Visible' : 'Hidden' }}</span>
        </div>
      </div>

      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Opacity</label>
        <div class="mt-1 text-sm">{{ Math.round(layer.opacity * 100) }}%</div>
      </div>

      <div v-if="layer.minZoom !== undefined || layer.maxZoom !== undefined">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Zoom Range</label>
        <div class="mt-1 text-sm">{{ layer.minZoom ?? 0 }} - {{ layer.maxZoom ?? '∞' }}</div>
      </div>

      <UEmpty
        v-if="!hasDetails"
        icon="i-heroicons-information-circle"
        message="No additional details available"
        description="This layer has no extra information to display"
      />
    </div>
  </UCard>
</template>
```

### Modified LayerManager (Add Click Handlers)

```vue
<!-- src/components/layer-manager/LayerManager.vue -->
<script setup lang="ts">
import { useLayerManagement } from '@/composables/useLayerManagement'
import type { MapContextLayer } from '@geospatial-sdk/core'

const { dataLayers, getMenuItems, getLabel } = useLayerManagement()

const emit = defineEmits<{
  selectLayer: [layer: MapContextLayer]
}>()

const handleLayerClick = (layer: MapContextLayer) => {
  emit('selectLayer', layer)
}
</script>

<template>
  <div class="layer-manager">
    <h3 class="my-2 px-3 text-lg font-semibold">Layers</h3>

    <UEmpty
      v-if="dataLayers.length === 0"
      variant="naked"
      icon="i-heroicons-queue-list"
      message="No layers added"
      description="Add layers to the map to see them here"
    />

    <div v-else>
      <div
        v-for="(layer, index) in dataLayers"
        :key="layer.id || `layer-${index}`"
        class="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        @click="handleLayerClick(layer)"
      >
        <UIcon name="i-tabler-stack-2" />
        <UTooltip :text="getLabel(layer)">
          <span class="flex-1 truncate text-sm">{{ getLabel(layer) }}</span>
        </UTooltip>
        <UDropdownMenu :items="getMenuItems(layer)" :content="{ side: 'right' }">
          <UButton icon="i-heroicons-ellipsis-vertical" variant="" size="sm" />
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>
```

---

## Common Patterns

### Pattern 1: Accessing Panel State

```typescript
// In any component
import { usePanelState } from '@/composables/usePanelState'

const { isDetailsVisible, selectedLayer, selectLayer, deselectLayer } = usePanelState()

// Check if details panel is visible
if (isDetailsVisible.value) {
  console.log('Details panel is open for:', selectedLayer.value?.label)
}
```

### Pattern 2: Programmatic Layer Selection

```typescript
// From any component with access to map store
import { useMapStore } from '@/stores/map.store'

const mapStore = useMapStore()

// Select a layer by ID
mapStore.selectLayer('layer-123')

// Deselect current layer
mapStore.deselectLayer()

// Check current selection
if (mapStore.selectedLayerId) {
  console.log('Layer selected:', mapStore.selectedLayer?.label)
}
```

### Pattern 3: Adding Visual Feedback for Selected Layer

```vue
<!-- In LayerManager.vue or similar -->
<template>
  <div
    v-for="layer in dataLayers"
    :key="layer.id"
    :class="[
      'layer-item',
      { 'bg-primary/10 border-l-2 border-primary': isSelected(layer) }
    ]"
    @click="handleLayerClick(layer)"
  >
    {{ layer.label }}
  </div>
</template>

<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import type { MapContextLayer } from '@geospatial-sdk/core'

const mapStore = useMapStore()

const isSelected = (layer: MapContextLayer) => {
  return mapStore.selectedLayerId === layer.id
}
</script>
```

---

## Testing Examples

### Unit Test: Panel State Composable

```typescript
// tests/unit/composables/usePanelState.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePanelState } from '@/composables/usePanelState'
import { useMapStore } from '@/stores/map.store'

describe('usePanelState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should return isDetailsVisible as false when no layer selected', () => {
    const { isDetailsVisible } = usePanelState()
    expect(isDetailsVisible.value).toBe(false)
  })

  it('should return isDetailsVisible as true when layer selected', () => {
    const mapStore = useMapStore()
    const { isDetailsVisible } = usePanelState()

    mapStore.selectLayer('layer-1')
    expect(isDetailsVisible.value).toBe(true)
  })

  it('should return activePanelCount as 1 when no selection', () => {
    const { activePanelCount } = usePanelState()
    expect(activePanelCount.value).toBe(1)
  })

  it('should return activePanelCount as 2 when layer selected', () => {
    const mapStore = useMapStore()
    const { activePanelCount } = usePanelState()

    mapStore.selectLayer('layer-1')
    expect(activePanelCount.value).toBe(2)
  })
})
```

### E2E Test: Full User Flow

```typescript
// tests/e2e/panel-interactions.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Panel Overlay Grid', () => {
  test('should show layer panel on load', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.panel-grid')).toBeVisible()
    await expect(page.locator('[data-testid="layer-panel"]')).toBeVisible()
  })

  test('should open details panel when layer clicked', async ({ page }) => {
    await page.goto('/')

    // Click first layer
    await page.locator('.layer-item').first().click()

    // Details panel should appear
    await expect(page.locator('[data-testid="layer-details-panel"]')).toBeVisible()

    // Grid should have 2 columns
    const grid = page.locator('.panel-grid')
    await expect(grid).toHaveClass(/grid-2-col/)
  })

  test('should close details panel when close button clicked', async ({ page }) => {
    await page.goto('/')
    await page.locator('.layer-item').first().click()

    // Click close button
    await page.locator('[data-testid="close-details"]').click()

    // Details panel should disappear
    await expect(page.locator('[data-testid="layer-details-panel"]')).not.toBeVisible()

    // Grid should have 1 column
    const grid = page.locator('.panel-grid')
    await expect(grid).toHaveClass(/grid-1-col/)
  })
})
```

---

## Troubleshooting

### Issue: Panels overlap the map

**Solution**: Ensure `pointer-events: none` is set on `.panel-grid` and `pointer-events: auto` on child panels:

```css
.panel-grid {
  pointer-events: none; /* Map clicks pass through */
}

.panel-grid > * {
  pointer-events: auto; /* Panel clicks captured */
}
```

### Issue: Grid transitions are janky

**Solution**: Avoid transitioning the grid itself. Only animate panel content:

```css
/* ❌ WRONG */
.panel-grid {
  transition: grid-template-columns 200ms;
}

/* ✅ CORRECT */
.panel-enter-active {
  transition: opacity 150ms, transform 150ms;
}
```

### Issue: Selected layer doesn't highlight

**Solution**: Add visual feedback in LayerManager based on `mapStore.selectedLayerId`:

```vue
<template>
  <div :class="{ 'selected': isSelected(layer) }">
    {{ layer.label }}
  </div>
</template>

<script setup lang="ts">
const isSelected = (layer) => mapStore.selectedLayerId === layer.id
</script>
```

---

## Next Steps

1. **Implement components**: Follow the examples above to create PanelGrid, LayerPanel, and LayerDetailsPanel
2. **Add tests**: Use the testing examples as templates for unit and E2E tests
3. **Extend functionality**: Add new panel types by updating the GridConfig and PanelType union
4. **Optimize performance**: Profile animations with Chrome DevTools to ensure 60fps

For detailed implementation tasks, see `/speckit.tasks` command output.
