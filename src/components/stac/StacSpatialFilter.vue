<template>
  <div class="flex items-center gap-2">
    <UCheckbox
      :model-value="filter.enabled"
      @update:model-value="updateEnabled"
    />
    <label class="text-sm cursor-pointer" @click="toggleEnabled">
      Filtrer par étendue visible de la carte
    </label>
  </div>
</template>

<script setup lang="ts">
import type { SpatialExtentFilter } from '@/types/stac-layer.types'

const props = defineProps<{
  filter: SpatialExtentFilter
}>()

const emit = defineEmits<{
  'update:filter': [filter: SpatialExtentFilter]
}>()

function updateEnabled(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    emit('update:filter', {
      ...props.filter,
      enabled: value,
    })
  }
}

function toggleEnabled() {
  updateEnabled(!props.filter.enabled)
}
</script>
