<template>
  <div class="space-y-3">
    <div>
      <div class="mb-2 flex items-center justify-between">
        <h4 class="text-sm font-semibold">Filtre temporel</h4>
      </div>
      <StacDateRangeFilter :filter="dateRange" @update:filter="updateDateRange" />
    </div>

    <div>
      <h4 class="mb-2 text-sm font-semibold">Filtre spatial</h4>
      <StacSpatialFilter :filter="spatialExtent" @update:filter="updateSpatialExtent" />
    </div>

    <UButton
      v-if="hasActiveFilters"
      size="xs"
      variant="soft"
      color="neutral"
      icon="i-heroicons-x-mark"
      @click="resetFilters"
    >
      Réinitialiser les filtres
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StacDateRangeFilter from './StacDateRangeFilter.vue'
import StacSpatialFilter from './StacSpatialFilter.vue'
import type { StacFilters, DateRangeFilter, SpatialExtentFilter } from '@/types/stac.types'

const props = defineProps<{
  filters: StacFilters
}>()

const emit = defineEmits<{
  'update:filters': [filters: StacFilters]
  'reset:filters': []
}>()

const dateRange = computed(() => props.filters.dateRange)
const spatialExtent = computed(() => props.filters.spatialExtent)

const hasActiveFilters = computed(() => {
  return (
    props.filters.dateRange.start !== null ||
    props.filters.dateRange.end !== null ||
    props.filters.spatialExtent.enabled
  )
})

function updateDateRange(newDateRange: DateRangeFilter) {
  emit('update:filters', {
    ...props.filters,
    dateRange: newDateRange,
  })
}

function updateSpatialExtent(newSpatialExtent: SpatialExtentFilter) {
  emit('update:filters', {
    ...props.filters,
    spatialExtent: newSpatialExtent,
  })
}

function resetFilters() {
  emit('reset:filters')
}
</script>
