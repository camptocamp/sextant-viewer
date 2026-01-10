<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayersStore } from '@/stores/layers.store.ts'
import { getLayerLabel } from '@/utils/layer.utils.ts'

defineProps<{
  layer: MapContextLayer
}>()

const layerStore = useLayersStore()

const handleClose = () => {
  layerStore.deselectLayer()
}
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
      <UButton icon="i-heroicons-x-mark" variant="ghost" size="sm" @click="handleClose" />
    </div>
    <!-- TODO: here, add different components based on the layer type -->
    <div>Contenu manquant !</div>
  </div>
</template>
