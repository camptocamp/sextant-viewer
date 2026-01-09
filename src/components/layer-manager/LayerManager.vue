<script setup lang="ts">
import type { MapContextLayer } from '@geospatial-sdk/core'
import { useLayerManagement } from '@/composables/useLayerManagement'
import { useLayersStore } from '@/stores/layers.store.ts'
import { storeToRefs } from 'pinia'

const { dataLayers, getMenuItems, getLabel } = useLayerManagement()
const layerStore = useLayersStore()
const { selectedLayer } = storeToRefs(layerStore)

const handleLayerClick = (layer: MapContextLayer) => {
  layerStore.selectLayer(layer)
}

const isSelected = (layer: MapContextLayer) => {
  return selectedLayer.value === layer
}
</script>

<template>
  <div class="">
    <UEmpty
      v-if="dataLayers.length === 0"
      variant="naked"
      icon="i-heroicons-queue-list"
      message="No layers added"
      description="Add layers to the map to see them here"
    />

    <div v-else ref="sortableRef" class="layer-list">
      <div
        v-for="(layer, index) in dataLayers"
        :key="layer.id || `layer-${index}`"
        class="flex cursor-pointer items-center gap-2 border-2 border-transparent px-2.5 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <UIcon
          name="i-tabler-stack-2"
          class="drag-handle cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        />
        <UTooltip :text="getLabel(layer)">
          <span class="flex-1 truncate text-sm">
            {{ getLabel(layer) }}
          </span>
        </UTooltip>

        <UDropdownMenu
          :items="getMenuItems(layer)"
          :content="{ side: 'right' }"
          :ui="{
            content: 'z-1 rounded py-2 px-0 shadow-dd min-w-48 backdrop-blur-md bg-white ',
            item: 'cursor-pointer px-3 py-1 text-sm capitalize hover:bg-primary/20 ',
            group: 'p-0',
            separator: 'mx-0 my-3',
          }"
        >
          <UButton
            icon="i-heroicons-ellipsis-vertical"
            variant=""
            size="sm"
            :ui="{
              base: 'p-0',
            }"
          />
        </UDropdownMenu>
      </div>
    </div>
  </div>
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
