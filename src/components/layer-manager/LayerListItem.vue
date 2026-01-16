<script setup lang="ts">
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, type MapLayer } from '@/utils/layer.utils'
import type { MapContextLayer } from '@geospatial-sdk/core'

const props = defineProps<{
  layer: MapLayer
  active: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

//TODO: support stac layers that would need geojson layer from sdkContext here
const { isVisible, toggleVisibility } = useLayerActions(() => props.layer as MapContextLayer)
</script>

<template>
  <UTooltip :text="getLayerLabel(layer)">
    <UButton
      class="flex w-full"
      size="md"
      :active="active"
      color="neutral"
      active-color="primary"
      variant="soft"
      active-variant="solid"
      @click="emit('click')"
    >
      <UIcon name="i-tabler-stack-2" class="drag-handle shrink-0 cursor-move" />
      <UCheckbox
        :model-value="isVisible"
        @update:model-value="toggleVisibility"
        @click.stop
        class="mx-1"
      />
      <span class="truncate text-sm">{{ getLayerLabel(layer) }}</span>
    </UButton>
  </UTooltip>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
