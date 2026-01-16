<script setup lang="ts">
import type { MapLayerStac, StacFilters } from '@/types/stac.types'
import StacItemsIndicator from '@/components/stac/StacItemsIndicator.vue'
import StacFilterPanel from '@/components/stac/StacFilterPanel.vue'
import StacPaginationControls from '@/components/stac/StacPaginationControls.vue'
import { useStacLayer } from '@/composables/useStacLayer'

const props = defineProps<{
  layer: MapLayerStac
}>()

const { updateStacFilters, loadNextPage, loadPreviousPage } = useStacLayer()

function updateFilters(filters: StacFilters) {
  updateStacFilters(props.layer, filters)
}

function resetFilters() {
  updateStacFilters(
    props.layer,
    props.layer.initialFilters || {
      dateRange: { start: null, end: null },
      spatialExtent: { enabled: false, bbox: null },
    },
  )
}

function handleNextPage() {
  loadNextPage(props.layer)
}

function handlePreviousPage() {
  loadPreviousPage(props.layer)
}
</script>

<template>
  <div class="mb-3 space-y-3">
    <StacItemsIndicator
      :loading="false"
      :error="null"
      :item-count="layer.pagination?.returnedItems || 0"
    />

    <StacFilterPanel
      :filters="
        layer.filters || {
          dateRange: { start: null, end: null },
          spatialExtent: { enabled: false, bbox: null },
        }
      "
      @update:filters="updateFilters"
      @reset:filters="resetFilters"
    />

    <StacPaginationControls
      :pagination="
        layer.pagination || {
          currentPage: 1,
          returnedItems: 0,
          itemsPerPage: 10,
          nextLink: null,
          previousLink: null,
        }
      "
      :loading="false"
      @next-page="handleNextPage"
      @prev-page="handlePreviousPage"
    />
  </div>
</template>
