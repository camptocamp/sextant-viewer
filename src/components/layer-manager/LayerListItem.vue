<script setup lang="ts">
import { computed } from 'vue'
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerError, getLayerLabel, type MapLayer } from '@/utils/layer.utils'
import { getWmsTimeDimension } from '@/utils/wms.utils'
import type { MapContextLayer, ResolvedMapLayerState } from '@geospatial-sdk/core'
import { getNcwmsInfo } from '@/utils/ncwms.utils'

const props = defineProps<{
  layer: MapLayer
  state?: ResolvedMapLayerState | null
  active: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

//TODO: support stac layers that would need geojson layer from sdkContext here
const { isVisible, toggleVisibility } = useLayerActions(() => props.layer as MapContextLayer)

const errorMessage = computed(() => {
  const s = props.state
  if (s && 'creationError' in s && s.creationError) return s.creationErrorMessage
  if (s && 'loadingError' in s && s.loadingErrorMessage) return s.loadingErrorMessage
  if (props.layer.error) return getLayerError(props.layer)
  return null
})
</script>

<template>
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

    <UIcon
      v-if="getWmsTimeDimension(layer)"
      name="i-lucide-alarm-clock"
      class="shrink-0 text-gray-400"
    />

    <UIcon v-if="getNcwmsInfo(layer)" name="i-lucide-palette" class="shrink-0 text-gray-400" />

    <UIcon
      v-if="state && 'loading' in state && state.loading"
      name="i-tabler-loader-2"
      class="shrink-0 animate-spin"
    />

    <span v-if="errorMessage" class="contents">
      <UTooltip>
        <span class="inline-flex shrink-0 text-red-400" role="img" :aria-label="errorMessage">
          <UIcon name="i-tabler-alert-circle" />
        </span>
        <template #content>
          <div class="flex items-center gap-1.5 text-red-400">
            <UIcon name="i-tabler-alert-circle" class="size-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
        </template>
      </UTooltip>
    </span>
  </UButton>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
