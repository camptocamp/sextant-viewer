# Quickstart Guide: Layer Manager Implementation

**Feature**: Layer Manager
**Date**: 2026-01-07
**Audience**: Developers implementing this feature

## Overview

This guide provides step-by-step instructions for implementing the layer manager component, from setting up the file structure to integrating with the application.

**Estimated Time**: 2-3 hours

**Prerequisites**:
- Familiarity with Vue 3 Composition API
- Understanding of Pinia store patterns
- Basic knowledge of NuxtUI components
- TypeScript experience

---

## Implementation Steps

### Step 1: Create Type Definitions (15 minutes)

**File**: `src/types/layer.ts`

Create the new types file with layer-related utilities:

```typescript
import type { MapContextLayer } from '@geospatial-sdk/core'

/**
 * Menu item structure for layer context menu
 */
export interface LayerMenuItem {
  label: string
  icon?: string
  click: () => void
  disabled?: boolean
}

/**
 * Type guard to identify basemap layers
 * @param layer - The layer to check
 * @param index - The layer's position in the layers array
 * @returns true if layer is a basemap, false otherwise
 */
export function isBasemapLayer(layer: MapContextLayer, index: number): boolean {
  return layer.id?.startsWith('basemap-') || index === 0
}

/**
 * Get display label for a layer with fallback
 * @param layer - The layer to get label from
 * @returns Layer label or 'Untitled Layer' if no label exists
 */
export function getLayerLabel(layer: MapContextLayer): string {
  return layer.label || 'Untitled Layer'
}
```

**Verification**:
```bash
npm run type-check  # Should pass without errors
```

---

### Step 2: Extend Map Store (15 minutes)

**File**: `src/stores/map.store.ts`

Add the `deleteLayer` action to the existing store:

```typescript
import { computed, ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { MapContext, MapContextLayer, MapContextView } from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'

export const useMapStore = defineStore('map', () => {
  const context: Ref<MapContext> = ref<MapContext>(DEFAULT_MAP_CONTEXT)

  const layers = computed(() => context.value.layers)
  const view = computed(() => context.value.view)

  function setView(view: MapContextView) {
    context.value = {
      ...context.value,
      view,
    }
  }

  function addLayer(layer: MapContextLayer) {
    context.value = {
      ...context.value,
      layers: [...context.value.layers, layer],
    }
  }

  // NEW: Delete layer action
  function deleteLayer(layer: MapContextLayer): void {
    context.value = removeLayerFromContext(context.value, layer)
  }

  return {
    context,
    layers,
    view,
    setView,
    addLayer,
    deleteLayer,  // Export new action
  }
})
```

**Verification**:
```bash
npm run type-check  # Should pass
```

**Test in Browser Console** (after implementation):
```javascript
const mapStore = useMapStore()
console.log('Before:', mapStore.layers.length)
mapStore.deleteLayer('some-layer-id')
console.log('After:', mapStore.layers.length)
```

---

### Step 3: Create Component Directory (5 minutes)

Create the layer components directory:

```bash
mkdir -p src/components/layer
```

---

### Step 4: Implement Layer Manager Component (60-90 minutes)

**File**: `src/components/layer/LayerManager.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import { isBasemapLayer, getLayerLabel, type LayerMenuItem } from '@/types/layer'
import type { MapContextLayer } from '@geospatial-sdk/core'

const mapStore = useMapStore()

/**
 * Compute non-basemap layers in reverse order (most visible first)
 */
const dataLayers = computed<MapContextLayer[]>(() => {
  const filtered = mapStore.layers.filter((layer, index) => !isBasemapLayer(layer, index))
  return [...filtered].reverse()
})

/**
 * Handle layer deletion
 */
const handleDeleteLayer = (layerId: string | undefined) => {
  if (!layerId) {
    console.warn('Cannot delete layer without ID')
    return
  }
  mapStore.deleteLayer(layerId)
}

/**
 * Generate context menu items for a layer
 */
const getMenuItems = (layer: MapContextLayer): LayerMenuItem[][] => {
  return [
    [
      {
        label: 'Delete layer',
        icon: 'i-heroicons-trash',
        click: () => handleDeleteLayer(layer.id),
        disabled: !layer.id
      }
    ]
  ]
}
</script>

<template>
  <div class="layer-manager p-4">
    <!-- Header -->
    <h3 class="text-lg font-semibold mb-4">Layers</h3>

    <!-- Empty State -->
    <UEmpty
      v-if="dataLayers.length === 0"
      icon="i-heroicons-queue-list"
      message="No layers added"
      description="Add layers to the map to see them here"
    />

    <!-- Layer List -->
    <div v-else class="space-y-2">
      <div
        v-for="(layer, index) in dataLayers"
        :key="layer.id || `layer-${index}`"
        class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <!-- Layer Label with Truncation -->
        <UTooltip :text="getLayerLabel(layer)">
          <span class="truncate flex-1 text-sm">
            {{ getLayerLabel(layer) }}
          </span>
        </UTooltip>

        <!-- Context Menu -->
        <UDropdownMenu :items="getMenuItems(layer)">
          <UButton
            icon="i-heroicons-ellipsis-vertical"
            variant="ghost"
            size="xs"
            :disabled="!layer.id"
          />
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-manager {
  min-height: 200px;
}
</style>
```

**Code Breakdown**:

1. **Imports** (Lines 2-5):
   - Store connection
   - Type utilities
   - MapContextLayer type

2. **Computed Properties** (Lines 9-13):
   - `dataLayers`: Filtered and reversed layer list
   - Uses spread to avoid mutating original array

3. **Methods** (Lines 15-32):
   - `handleDeleteLayer`: Delete with validation
   - `getMenuItems`: Generate context menu structure

4. **Template** (Lines 36-71):
   - Header
   - Empty state (UEmpty)
   - Layer list with v-for
   - UTooltip for full label on hover
   - UDropdownMenu with UButton trigger

5. **Styling** (Lines 73-77):
   - Minimal scoped styles
   - Tailwind classes for layout

**Verification Steps**:

1. Type check:
   ```bash
   npm run type-check
   ```

2. Lint check:
   ```bash
   npm run lint
   ```

3. Check component size:
   ```bash
   wc -l src/components/layer/LayerManager.vue
   # Should be < 200 lines
   ```

---

### Step 5: Integrate Component into Application (15 minutes)

**Option A: Sidebar Integration**

Edit your main view or layout file (e.g., `src/views/MapView.vue`):

```vue
<script setup lang="ts">
import MapViewer from '@/components/map/MapViewer.vue'
import LayerManager from '@/components/layer/LayerManager.vue'
</script>

<template>
  <div class="flex h-screen">
    <!-- Sidebar with Layer Manager -->
    <aside class="w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
      <LayerManager />
    </aside>

    <!-- Map View -->
    <main class="flex-1">
      <MapViewer />
    </main>
  </div>
</template>
```

**Option B: Floating Panel Integration**

```vue
<template>
  <div class="relative h-screen">
    <!-- Map View -->
    <MapViewer />

    <!-- Floating Layer Manager Panel -->
    <div class="absolute top-4 left-4 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <LayerManager />
    </div>
  </div>
</template>
```

**Choose Based On**:
- Sidebar: Fixed layout, always visible, more space
- Floating: Overlay, dismissible, saves map space

---

### Step 6: Test the Implementation (30 minutes)

#### Manual Testing Checklist

1. **Empty State Test**:
   - [ ] Open app with only basemap
   - [ ] Verify "No layers added" message displays
   - [ ] Verify UEmpty component shows correct icon

2. **Layer Display Test**:
   - [ ] Add 2-3 layers to map (use existing add layer functionality)
   - [ ] Verify layers appear in list
   - [ ] Verify topmost layer appears first in list
   - [ ] Verify basemap does not appear in list

3. **Label Truncation Test**:
   - [ ] Add layer with very long name (50+ characters)
   - [ ] Verify label truncates with ellipsis
   - [ ] Hover over label
   - [ ] Verify tooltip shows full label

4. **Context Menu Test**:
   - [ ] Click dot icon next to a layer
   - [ ] Verify context menu opens
   - [ ] Verify "Delete layer" option appears with trash icon
   - [ ] Click outside menu
   - [ ] Verify menu closes without deleting

5. **Deletion Test**:
   - [ ] Click dot icon
   - [ ] Click "Delete layer"
   - [ ] Verify layer removed from list
   - [ ] Verify layer removed from map
   - [ ] Verify remaining layers still display correctly

6. **Reactivity Test**:
   - [ ] Delete all data layers
   - [ ] Verify empty state appears
   - [ ] Add new layer (via other mechanism)
   - [ ] Verify layer appears in list immediately

7. **Edge Cases**:
   - [ ] Test with 10+ layers
   - [ ] Test with layers having no labels
   - [ ] Test with layers having special characters in labels
   - [ ] Test rapid deletion (delete multiple layers quickly)

#### Browser Console Tests

Open browser console and run:

```javascript
// Get store
const mapStore = useMapStore()

// Test 1: Verify data layers computed property
console.log('Basemap:', mapStore.layers[0])
console.log('Data layers count:', mapStore.layers.length - 1)

// Test 2: Add test layer
mapStore.addLayer({
  id: 'test-layer-1',
  type: 'wms',
  label: 'Test Layer 1',
  url: 'https://example.com/wms',
  visibility: true,
  opacity: 1
})

// Test 3: Verify layer appears
console.log('After add:', mapStore.layers.length)

// Test 4: Delete test layer
mapStore.deleteLayer('test-layer-1')
console.log('After delete:', mapStore.layers.length)
```

---

### Step 7: Verify Constitution Compliance (15 minutes)

Use the verification checklist from [plan.md](./plan.md):

- [ ] LayerManager.vue uses only NuxtUI components
- [ ] Component uses `<script setup>` with TypeScript
- [ ] Layer filtering excludes basemap
- [ ] Layers displayed in reverse array order
- [ ] Layer labels truncate with ellipsis
- [ ] Context menu opens on dot icon click
- [ ] Delete action removes layer from MapContext
- [ ] Empty state shows UEmpty component
- [ ] Component size ≤ 200 lines
- [ ] All functions ≤ 20 lines
- [ ] ESLint/Prettier passing
- [ ] No `any` types
- [ ] deleteLayer action in store
- [ ] Immutable MapContext updates

Run automated checks:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build (ensures no errors)
npm run build
```

---

## Troubleshooting

### Issue: Layers Not Appearing

**Symptoms**: Empty state shows even when layers exist

**Possible Causes**:
1. Basemap filter too aggressive
2. MapContext not loading

**Solution**:
```javascript
// In browser console
console.log('All layers:', mapStore.layers)
console.log('Basemap check:', mapStore.layers.map((l, i) => isBasemapLayer(l, i)))
```

### Issue: Deletion Not Working

**Symptoms**: Click delete, but layer remains

**Possible Causes**:
1. Layer missing id property
2. Store action not called

**Solution**:
```javascript
// Add console.log to handleDeleteLayer
const handleDeleteLayer = (layerId: string | undefined) => {
  console.log('Deleting layer:', layerId)
  if (!layerId) {
    console.warn('Cannot delete layer without ID')
    return
  }
  mapStore.deleteLayer(layerId)
  console.log('After delete:', mapStore.layers.length)
}
```

### Issue: Context Menu Not Opening

**Symptoms**: Click button, no menu appears

**Possible Causes**:
1. NuxtUI not properly configured
2. Incorrect props structure

**Solution**:
- Verify NuxtUI is installed: Check `package.json`
- Check console for errors
- Verify menu items structure matches NuxtUI API

### Issue: Type Errors

**Symptoms**: TypeScript compilation errors

**Possible Causes**:
1. Missing type imports
2. Incorrect type annotations

**Solution**:
```bash
# Check specific file
npx vue-tsc --noEmit src/components/layer/LayerManager.vue
```

---

## Performance Validation

### Expected Performance Metrics

Based on success criteria from [spec.md](./spec.md):

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Layer list render | < 1 second | Open layer manager, use DevTools Performance tab |
| Context menu open/close | < 100ms | Click menu button, check responsiveness |
| List update after deletion | < 100ms | Delete layer, observe UI update |
| Support 50 layers | No lag | Add 50 layers, test scrolling and interaction |

### Performance Testing

```javascript
// Add 50 test layers
for (let i = 0; i < 50; i++) {
  mapStore.addLayer({
    id: `test-layer-${i}`,
    type: 'wms',
    label: `Test Layer ${i}`,
    visibility: true,
    opacity: 1
  })
}

// Test rendering time
console.time('render')
// Open layer manager or trigger re-render
console.timeEnd('render')
// Should be < 1000ms
```

---

## Next Steps

After implementation:

1. **Create Pull Request**:
   - Branch: `003-layer-manager`
   - Reference: `specs/003-layer-manager/spec.md`
   - Include screenshots of UI

2. **Request Code Review**:
   - Verify constitution compliance
   - Check TypeScript types
   - Validate NuxtUI usage

3. **User Testing**:
   - Have team members test layer management workflow
   - Gather feedback on UX

4. **Documentation**:
   - Update project README if needed
   - Document layer manager usage for end users

---

## Reference Files

- **Specification**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Research**: [research.md](./research.md)
- **Constitution**: `/.specify/memory/constitution.md`

---

## Quick Commands Reference

```bash
# Development
npm run dev                 # Start dev server
npm run type-check          # Check TypeScript
npm run lint                # Run ESLint
npm run format              # Format with Prettier

# Building
npm run build               # Production build
npm run preview             # Preview build

# File locations
src/components/layer/LayerManager.vue   # Main component
src/stores/map.store.ts                 # Store with deleteLayer
src/types/layer.ts                      # Type definitions
```

---

**Implementation Status**: Ready to begin - All design artifacts complete.
