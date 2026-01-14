<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel } from '@/utils/layer.utils'

const props = defineProps<{
  layer: MapContextLayer
  active: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const { isVisible, toggleVisibility } = useLayerActions(() => props.layer)
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
