<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { getLayerLabel } from '@/utils/layer.utils.ts'

defineProps<{
  layer: MapContextLayer
}>()
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>
    <!-- TODO: here, add different components based on the layer type -->
    <div>Contenu manquant !</div>
  </div>
</template>
