<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayersStore } from '@/stores/layers.store.ts'

defineProps<{
  layer: MapContextLayer
}>()

const layerStore = useLayersStore()

const handleClose = () => {
  layerStore.deselectLayer()
}
</script>

<template>
  <div class="p-4">
    <div class="flex items-center justify-between">
      <h3 class="truncate text-lg font-semibold">
        {{ layer.label || layer.id }}
      </h3>
      <UButton icon="i-heroicons-x-mark" variant="ghost" size="sm" @click="handleClose" />
    </div>
    <div>
      <UBadge :label="layer.type" class="mt-1" />
    </div>
  </div>
</template>
