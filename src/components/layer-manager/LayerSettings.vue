<script setup lang="ts">
import { useLayerActions } from '@/composables/useLayerActions'
import type { MapLayer } from '@/utils/layer.utils'

const props = defineProps<{
  layer: MapLayer
}>()

const { opacity } = useLayerActions(() => props.layer)
</script>

<template>
  <div class="flex items-baseline gap-2">
    <span class="shrink-0">Transparence :</span
    ><USlider v-model="opacity" :min="0" :max="100" tooltip class="w-full" />
  </div>
</template>
