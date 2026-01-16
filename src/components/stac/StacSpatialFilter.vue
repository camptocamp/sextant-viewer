<template>
  <div class="flex items-center gap-2">
    <UCheckbox :model-value="filter.enabled" @update:model-value="updateEnabled" />
    <label class="cursor-pointer text-sm" @click="toggleEnabled">
      Filtrer par étendue visible de la carte
    </label>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useMapStore } from '@/stores/map.store'
import type { SpatialExtentFilter } from '@/types/stac.types'

const props = defineProps<{
  filter: SpatialExtentFilter
}>()

const emit = defineEmits<{
  'update:filter': [filter: SpatialExtentFilter]
}>()

const mapStore = useMapStore()

function updateEnabled(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    const updates: Partial<SpatialExtentFilter> = {
      enabled: value,
    }

    if (value && mapStore.currentExtent) {
      updates.bbox = mapStore.currentExtent
    }

    emit('update:filter', {
      ...props.filter,
      ...updates,
    })
  }
}

function toggleEnabled() {
  updateEnabled(!props.filter.enabled)
}

const debouncedExtentUpdate = useDebounceFn(() => {
  if (props.filter.enabled && mapStore.currentExtent) {
    emit('update:filter', {
      ...props.filter,
      bbox: mapStore.currentExtent,
    })
  }
}, 500)

watch(
  () => mapStore.currentExtent,
  () => {
    debouncedExtentUpdate()
  },
)
</script>
