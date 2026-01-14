# Quickstart Guide: STAC Layer Support

**Feature**: 005-stac-layer-support  
**Date**: 2026-01-14  
**Audience**: Developers implementing the feature

## Overview

This guide provides step-by-step instructions for implementing STAC (SpatioTemporal Asset Catalog) layer support in the map viewer. Follow these phases in order to build the feature incrementally.

## Prerequisites

- ✅ @camptocamp/ogc-client (^1.3.1-dev.53a6449) - already installed
- ✅ @geospatial-sdk/core (^0.0.5-dev.44) - already installed
- ✅ NuxtUI (^4.3.0) - already installed
- ✅ Pinia (^3.0.4) - already installed

**New Dependency Required**:

```bash
npm install @vueuse/core
```

## Phase 1: Type System & Contracts (30 min)

### 1.1 Create Type Definitions

Create `src/types/stac-layer.types.ts`:

```typescript
// Copy content from specs/005-stac-layer-support/contracts/stac-layer.ts
// This defines MapLayerStac, StacFilters, DateRangeFilter, etc.
```

Create `src/types/stac-api.types.ts`:

```typescript
// Copy content from specs/005-stac-layer-support/contracts/stac-api.ts
// This defines StacItemsRequestParams, helper functions, etc.
```

### 1.2 Update Layer Utils

Extend `src/utils/layer.utils.ts`:

```typescript
import type { MapLayerStac } from '@/types/stac-layer.types'

export type MapLayer = MapContextLayer | MapLayerStac

export function isStacLayer(layer: any): layer is MapLayerStac {
  return layer?.type === 'stac'
}

export function isMapContextLayer(layer: MapLayer): layer is MapContextLayer {
  return layer.type !== 'stac'
}
```

**Test**: TypeScript should compile without errors.

---

## Phase 2: Store Extension (45 min)

### 2.1 Modify map.store.ts

Update `src/stores/map.store.ts` to support STAC layers:

```typescript
import { computed, ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addLayerToContext,
  changeLayerPositionInContext,
  getLayerPosition,
  type MapContext,
  type MapContextLayer,
  type MapContextLayerGeojson,
  type MapContextView,
  removeLayerFromContext,
  replaceLayerInContext,
} from '@geospatial-sdk/core'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'
import type { MapLayer } from '@/utils/layer.utils'
import { isStacLayer, isMapContextLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac-layer.types'

export const useMapStore = defineStore('map', () => {
  // Internal layers including STAC
  const internalLayers = ref<MapLayer[]>([])
  const baseView = ref<MapContextView>(DEFAULT_MAP_CONTEXT.view)

  // Computed context that maps STAC → GeoJSON
  const context: Ref<MapContext> = computed(() => ({
    view: baseView.value,
    layers: internalLayers.value.map((layer) =>
      isStacLayer(layer) ? mapStacToGeojson(layer) : layer,
    ),
  }))

  const layers = computed(() => internalLayers.value)
  const view = computed(() => baseView.value)

  function setView(view: MapContextView) {
    baseView.value = view
  }

  function addLayer(layer: MapLayer) {
    internalLayers.value.push(layer)
  }

  function deleteLayer(layer: MapLayer): void {
    const index = internalLayers.value.findIndex((l) => l.id === layer.id)
    if (index >= 0) {
      internalLayers.value.splice(index, 1)
    }
  }

  function updateLayer(layer: MapLayer, updates: Partial<MapLayer>) {
    const index = internalLayers.value.findIndex((l) => l.id === layer.id)
    if (index >= 0) {
      internalLayers.value[index] = { ...layer, ...updates } as MapLayer
    }
  }

  function mapStacToGeojson(stacLayer: MapLayerStac): MapContextLayerGeojson {
    return {
      type: 'geojson',
      id: stacLayer.id,
      label: stacLayer.label,
      visibility: stacLayer.visibility,
      version: stacLayer.version,
      data: {
        type: 'FeatureCollection',
        features: stacLayer.items,
      },
      style: {
        'fill-color': 'rgba(255, 0, 0, 0.1)',
        'stroke-color': '#ff0000',
        'stroke-width': 2,
      },
    }
  }

  return {
    context,
    layers,
    view,
    setView,
    addLayer,
    deleteLayer,
    updateLayer,
  }
})
```

**Test**: Application should still load without errors. Existing layers should work as before.

---

## Phase 3: STAC Operations Composable (60 min)

### 3.1 Create useStacOperations composable

Create `src/composables/useStacOperations.ts`:

```typescript
import { ref } from 'vue'
import { StacEndpoint } from '@camptocamp/ogc-client'
import type { MapLayerStac } from '@/types/stac-layer.types'
import type { StacItemsResponse } from '@/types/stac-api.types'
import { buildStacRequestParams, extractPaginationLinks } from '@/types/stac-api.types'

export function useStacOperations() {
  const endpoints = new Map<string, StacEndpoint>()

  function getEndpoint(url: string): StacEndpoint {
    if (!endpoints.has(url)) {
      endpoints.set(url, new StacEndpoint(url))
    }
    return endpoints.get(url)!
  }

  async function fetchStacItems(layer: MapLayerStac): Promise<StacItemsResponse> {
    const endpoint = getEndpoint(layer.url)
    const params = buildStacRequestParams(layer.filters, layer.pagination.itemsPerPage)

    return await endpoint.getCollectionItemsResponse(layer.collectionId, params)
  }

  async function fetchStacItemsByLink(url: string): Promise<StacItemsResponse> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch STAC items: ${response.statusText}`)
    }
    return await response.json()
  }

  async function fetchCollectionMetadata(url: string, collectionId: string) {
    const endpoint = getEndpoint(url)
    return await endpoint.getCollection(collectionId)
  }

  return {
    fetchStacItems,
    fetchStacItemsByLink,
    fetchCollectionMetadata,
  }
}
```

**Test**: Import the composable in a component - should compile without errors.

---

## Phase 4: Store Actions for STAC (45 min)

### 4.1 Add STAC Actions to map.store.ts

Add these actions to the map store:

```typescript
import { useStacOperations } from '@/composables/useStacOperations'
import { extractPaginationLinks } from '@/types/stac-api.types'

// Inside defineStore setup function:
const stacOps = useStacOperations()

async function refetchStacLayerItems(layerId: string): Promise<void> {
  const layer = internalLayers.value.find((l) => l.id === layerId)
  if (!layer || !isStacLayer(layer)) {
    return
  }

  layer.loading = true
  layer.error = null
  layer.pagination.currentPage = 1

  try {
    const response = await stacOps.fetchStacItems(layer)

    const { nextLink, prevLink } = extractPaginationLinks(response)

    layer.items = response.features || []
    layer.pagination.totalItems = response.numberMatched ?? null
    layer.pagination.nextLink = nextLink
    layer.pagination.prevLink = prevLink
    layer.pagination.currentPage = 1
  } catch (error: any) {
    layer.error = error.message || 'Failed to fetch STAC items'
    console.error('STAC fetch error:', error)
  } finally {
    layer.loading = false
  }
}

async function goToNextStacPage(layerId: string): Promise<void> {
  const layer = internalLayers.value.find((l) => l.id === layerId)
  if (!layer || !isStacLayer(layer) || !layer.pagination.nextLink) {
    return
  }

  layer.loading = true
  layer.error = null

  try {
    const response = await stacOps.fetchStacItemsByLink(layer.pagination.nextLink)

    const { nextLink, prevLink } = extractPaginationLinks(response)

    layer.items = response.features || []
    layer.pagination.nextLink = nextLink
    layer.pagination.prevLink = prevLink
    layer.pagination.currentPage += 1
  } catch (error: any) {
    layer.error = error.message || 'Failed to fetch next page'
    console.error('STAC pagination error:', error)
  } finally {
    layer.loading = false
  }
}

async function goToPrevStacPage(layerId: string): Promise<void> {
  const layer = internalLayers.value.find((l) => l.id === layerId)
  if (!layer || !isStacLayer(layer) || !layer.pagination.prevLink) {
    return
  }

  layer.loading = true
  layer.error = null

  try {
    const response = await stacOps.fetchStacItemsByLink(layer.pagination.prevLink)

    const { nextLink, prevLink } = extractPaginationLinks(response)

    layer.items = response.features || []
    layer.pagination.nextLink = nextLink
    layer.pagination.prevLink = prevLink
    layer.pagination.currentPage -= 1
  } catch (error: any) {
    layer.error = error.message || 'Failed to fetch previous page'
    console.error('STAC pagination error:', error)
  } finally {
    layer.loading = false
  }
}

// Add to return statement:
return {
  context,
  layers,
  view,
  setView,
  addLayer,
  deleteLayer,
  updateLayer,
  refetchStacLayerItems,
  goToNextStacPage,
  goToPrevStacPage,
}
```

**Test**: Manually call `refetchStacLayerItems` with a test STAC layer - should fetch items.

---

## Phase 5: UI Components (2 hours)

### 5.1 Create StacFilterPanel Component

Create `src/components/stac/StacFilterPanel.vue`:

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { MapLayerStac } from '@/types/stac-layer.types'
import { useMapStore } from '@/stores/map.store'

const props = defineProps<{
  layer: MapLayerStac
}>()

const mapStore = useMapStore()

// Watch date range changes
watch(
  () => props.layer.filters.dateRange,
  async () => {
    await mapStore.refetchStacLayerItems(props.layer.id)
  },
  { deep: true },
)

// Watch spatial filter toggle
watch(
  () => props.layer.filters.spatialExtent.enabled,
  async (enabled) => {
    if (enabled) {
      const bounds = mapStore.view.extent
      if (bounds) {
        props.layer.filters.spatialExtent.bbox = [bounds[0], bounds[1], bounds[2], bounds[3]]
      }
    } else {
      props.layer.filters.spatialExtent.bbox = null
    }
    await mapStore.refetchStacLayerItems(props.layer.id)
  },
)

// Debounced map extent changes
const debouncedExtentUpdate = useDebounceFn(async () => {
  if (props.layer.filters.spatialExtent.enabled) {
    const bounds = mapStore.view.extent
    if (bounds) {
      props.layer.filters.spatialExtent.bbox = [bounds[0], bounds[1], bounds[2], bounds[3]]
      await mapStore.refetchStacLayerItems(props.layer.id)
    }
  }
}, 500)

watch(() => mapStore.view.extent, debouncedExtentUpdate)
</script>

<template>
  <div class="space-y-4">
    <UFieldGroup label="Date Range">
      <div class="grid grid-cols-2 gap-2">
        <UInput v-model="layer.filters.dateRange.start" type="date" placeholder="Start date" />
        <UInput v-model="layer.filters.dateRange.end" type="date" placeholder="End date" />
      </div>
    </UFieldGroup>

    <UFieldGroup label="Spatial Filter">
      <UCheckbox v-model="layer.filters.spatialExtent.enabled" label="Use current map extent" />
    </UFieldGroup>
  </div>
</template>
```

### 5.2 Create StacPaginationControls Component

Create `src/components/stac/StacPaginationControls.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MapLayerStac } from '@/types/stac-layer.types'
import { useMapStore } from '@/stores/map.store'

const props = defineProps<{
  layer: MapLayerStac
}>()

const mapStore = useMapStore()

const hasNextPage = computed(() => props.layer.pagination.nextLink !== null)
const hasPrevPage = computed(() => props.layer.pagination.prevLink !== null)

const countText = computed(() => {
  const total = props.layer.pagination.totalItems
  const totalText = total !== null ? total.toLocaleString() : 'unknown'
  return `Page ${props.layer.pagination.currentPage} • ${totalText} items`
})

async function goToNext() {
  await mapStore.goToNextStacPage(props.layer.id)
}

async function goToPrev() {
  await mapStore.goToPrevStacPage(props.layer.id)
}
</script>

<template>
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">{{ countText }}</span>

    <div class="flex gap-2">
      <UButton
        icon="i-heroicons-chevron-left"
        :disabled="!hasPrevPage || layer.loading"
        @click="goToPrev"
        size="sm"
      >
        Previous
      </UButton>

      <UButton
        icon="i-heroicons-chevron-right"
        :disabled="!hasNextPage || layer.loading"
        @click="goToNext"
        size="sm"
      >
        Next
      </UButton>
    </div>
  </div>
</template>
```

### 5.3 Extend LayerDetailsPanel

Update `src/components/layer-manager/LayerDetailsPanel.vue` to show STAC controls:

```vue
<script setup lang="ts">
import { isStacLayer } from '@/utils/layer.utils'
import StacFilterPanel from '@/components/stac/StacFilterPanel.vue'
import StacPaginationControls from '@/components/stac/StacPaginationControls.vue'

// Existing code...

const isStac = computed(() => isStacLayer(props.layer))
</script>

<template>
  <div>
    <!-- Existing layer controls -->

    <!-- STAC-specific controls -->
    <div v-if="isStac" class="mt-4 space-y-4">
      <USkeleton v-if="layer.loading" class="h-20" />

      <UAlert v-else-if="layer.error" color="red" :title="layer.error" />

      <template v-else>
        <StacFilterPanel :layer="layer" />
        <StacPaginationControls :layer="layer" />
      </template>
    </div>
  </div>
</template>
```

**Test**: Add a STAC layer manually via console:

```javascript
const mapStore = useMapStore()
mapStore.addLayer({
  type: 'stac',
  id: 'test-stac-1',
  url: 'https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr',
  collectionId: 'sentinel-2-radiometric-indices',
  label: 'Test STAC Layer',
  visibility: true,
  version: 0,
  filters: {
    dateRange: { start: null, end: null },
    spatialExtent: { enabled: false, bbox: null },
  },
  pagination: {
    currentPage: 1,
    totalItems: null,
    itemsPerPage: 50,
    nextLink: null,
    prevLink: null,
  },
  items: [],
  loading: false,
  error: null,
})

mapStore.refetchStacLayerItems('test-stac-1')
```

---

## Phase 6: Testing & Polish (1 hour)

### 6.1 Manual Testing Checklist

- [ ] Add STAC layer via console
- [ ] Verify items appear on map
- [ ] Toggle layer visibility - items hide/show
- [ ] Change date range - items refetch
- [ ] Enable spatial filter - items refetch with map bounds
- [ ] Pan/zoom map (spatial filter enabled) - items refetch after debounce
- [ ] Navigate to next page - items update
- [ ] Navigate to previous page - items update
- [ ] Test with invalid URL - error message displays
- [ ] Test with collection that has no items - empty state displays

### 6.2 Error Handling

Add toast notifications for errors (use NuxtUI toast):

```typescript
// In map.store.ts refetchStacLayerItems:
} catch (error: any) {
  layer.error = error.message || 'Failed to fetch STAC items'

  // Add toast notification
  const toast = useToast()
  toast.add({
    title: 'STAC Layer Error',
    description: layer.error,
    color: 'red',
  })

  console.error('STAC fetch error:', error)
}
```

---

## Phase 7: Integration with LayerManager (30 min)

### 7.1 Add STAC Layer Creation UI (Future Enhancement)

For initial implementation, STAC layers can be added programmatically. In future sprints, add UI for:

- URL input field
- Collection browser
- "Add STAC Layer" button

---

## Verification

### Final Checklist

- [ ] TypeScript compiles without errors
- [ ] All constitution checks pass
- [ ] STAC layers appear in layer manager
- [ ] Items render on map as GeoJSON geometries
- [ ] Date range filter works
- [ ] Spatial extent filter works
- [ ] Pagination controls work
- [ ] Loading indicators display during fetch
- [ ] Error messages display on failure
- [ ] Multiple STAC layers can coexist
- [ ] STAC layers don't interfere with existing layer types

### Performance Checks

- [ ] Map remains responsive when panning/zooming
- [ ] Debouncing prevents excessive API calls
- [ ] 50 items render smoothly on map
- [ ] Filter changes cancel pending requests

---

## Common Issues

### Issue: CORS errors

**Solution**: STAC API must have CORS enabled. Test with curl:

```bash
curl -I https://stacapi-cdos.apps.okd.crocc.meso.umontpellier.fr/collections/sentinel-2-radiometric-indices
```

Look for `Access-Control-Allow-Origin` header.

### Issue: Items not appearing on map

**Debug steps**:

1. Check `layer.items` array is populated
2. Check `layer.visibility` is true
3. Check items have valid geometries
4. Check map extent includes item locations

### Issue: Filters not triggering refetch

**Debug steps**:

1. Verify watchers are registered (check Vue devtools)
2. Check deep watch is enabled for dateRange
3. Verify filter changes update reactive properties

---

## Next Steps

After implementing this feature:

1. Add UI for discovering/adding STAC collections
2. Add item detail popup on click
3. Add custom styling based on item properties
4. Add export filtered items to GeoJSON
5. Add persistence of STAC layer configuration

## References

- [Spec Document](../spec.md)
- [Research Document](../research.md)
- [Data Model](../data-model.md)
- [Type Contracts](../contracts/)
- [STAC Specification](https://stacspec.org/)
- [ogc-client STAC Documentation](../../.claude/skills/ogc-client/SKILL.md)
