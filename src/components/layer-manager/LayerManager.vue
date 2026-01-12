<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayerManagement } from '@/composables/useLayerManagement'
import { useLayersStore } from '@/stores/layers.store.ts'
import { storeToRefs } from 'pinia'
import SubdividedPanel from '@/components/layout/SubdividedPanel.vue'

const { dataLayers, getLabel, sortableRef } = useLayerManagement()
const layerStore = useLayersStore()
const { selectedLayer } = storeToRefs(layerStore)

const handleLayerClick = (layer: MapContextLayer) => {
  if (layer !== selectedLayer.value) {
    layerStore.selectLayer(layer)
  } else {
    layerStore.deselectLayer()
  }
}

const isSelected = (layer: MapContextLayer) => {
  return selectedLayer.value === layer
}

const handleDeselectLayer = () => {
  layerStore.deselectLayer()
}
</script>

<template>
  <SubdividedPanel :show-subdivision="!!selectedLayer" @close-panel="handleDeselectLayer">
    <template #default>
      <UEmpty
        v-if="dataLayers.length === 0"
        variant="naked"
        icon="i-heroicons-queue-list"
        message="No layers added"
        description="Add layers to the map to see them here"
      />

      <div v-else ref="sortableRef" class="layer-list flex flex-col gap-2">
        <UTooltip
          v-for="(layer, index) in dataLayers"
          :key="layer.id || `layer-${index}`"
          :text="getLabel(layer)"
        >
          <UButton
            class="flex w-full"
            size="md"
            :active="isSelected(layer)"
            color="neutral"
            active-color="primary"
            variant="soft"
            active-variant="solid"
            @click="handleLayerClick(layer)"
          >
            <UIcon name="i-tabler-stack-2" class="drag-handle shrink-0 cursor-move" />
            <span class="truncate text-sm">{{ getLabel(layer) }}</span>
          </UButton>
        </UTooltip>
      </div>
    </template>

    <template #subdivision>
      <LayerDetailsPanel :layer="selectedLayer!" />
    </template>
  </SubdividedPanel>
</template>

<style scoped>
.drag-handle {
  touch-action: none;
}

:deep(.sortable-ghost) {
  opacity: 0.4;
  background-color: rgb(59 130 246 / 0.1);
  border: 2px dashed rgb(59 130 246 / 0.5);
}

:deep(.sortable-drag) {
  opacity: 0.8;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
