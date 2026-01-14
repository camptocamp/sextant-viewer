<script setup lang="ts">
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, isStacLayer } from '@/utils/layer.utils'
import type { MapLayer } from '@/utils/layer.utils'
import type { StacFilters } from '@/types/stac-layer.types'
import StacItemsIndicator from '@/components/stac/StacItemsIndicator.vue'
import StacFilterPanel from '@/components/stac/StacFilterPanel.vue'
import StacPaginationControls from '@/components/stac/StacPaginationControls.vue'
import { useMapStore } from '@/stores/map.store'

const props = defineProps<{
  layer: MapLayer
}>()

const { opacity, canZoomToExtent, zoomToExtent, deleteLayer } = useLayerActions(() => props.layer)
const mapStore = useMapStore()

function updateFilters(filters: StacFilters) {
  //TODO: check update filters
  if (isStacLayer(props.layer)) {
    mapStore.updateLayer(props.layer, { filters })
  }
}

function handleNextPage() {
  //TODO: implement pagination
}

function handlePrevPage() {
  //TODO: implement pagination
}
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>
    <!-- TODO: move to seperate component -->
    <!-- STAC layer-specific information -->
    <div v-if="isStacLayer(layer)" class="mb-3 space-y-3">
      <StacItemsIndicator
        :loading="false"
        :error="null"
        :item-count="layer.pagination?.itemsPerPage!"
      />

      <StacFilterPanel
        :filters="
          layer.filters || {
            dateRange: { start: null, end: null },
            spatialExtent: { enabled: false, bbox: null },
          }
        "
        @update:filters="updateFilters"
      />

      <StacPaginationControls
        :pagination="
          layer.pagination || {
            currentPage: 1,
            totalItems: 0,
            itemsPerPage: 10,
            nextLink: null,
            prevLink: null,
          }
        "
        :loading="false"
        @next-page="handleNextPage"
        @prev-page="handlePrevPage"
      />
    </div>

    <div class="mb-3 flex items-baseline gap-2">
      <span class="shrink-0">Transparence :</span
      ><USlider v-model="opacity" :min="0" :max="100" tooltip class="w-full" />
    </div>

    <div class="flex gap-2">
      <UButton
        icon="i-heroicons-arrows-pointing-out"
        color="primary"
        variant="soft"
        size="sm"
        :disabled="!canZoomToExtent"
        @click="zoomToExtent"
      >
        Zoomer sur l'extent
      </UButton>
      <UButton icon="i-heroicons-trash" color="error" variant="soft" size="sm" @click="deleteLayer">
        Supprimer
      </UButton>
    </div>
  </div>
</template>
