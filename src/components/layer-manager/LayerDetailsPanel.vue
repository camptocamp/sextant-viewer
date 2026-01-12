<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { computed } from 'vue'
import { getLayerLabel } from '@/utils/layer.utils.ts'
import { useMapStore } from '@/stores/map.store.ts'

const props = defineProps<{
  layer: MapContextLayer
}>()

const mapStore = useMapStore()

const opacity = computed({
  get: () => Math.floor((props.layer.opacity ?? 1) * 100),
  set: (value: number) => {
    mapStore.updateLayer(props.layer, { opacity: value / 100 })
  },
})
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>
    <!-- TODO: here, add different components based on the layer type -->

    <div class="flex items-baseline gap-2">
      <span class="shrink-0">Transparence :</span
      ><USlider v-model="opacity" :min="0" :max="100" tooltip class="w-full" />
    </div>
  </div>
</template>
