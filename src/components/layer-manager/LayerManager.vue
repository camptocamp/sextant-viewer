<script setup lang="ts">
import { useLayerManagement } from '@/composables/useLayerManagement'

const { dataLayers, getMenuItems, getLabel, sortableRef } = useLayerManagement()
</script>

<template>
  <div class="">
    <h3 class="my-2 px-3 text-lg font-semibold">Layers</h3>

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
        class="layer-item flex items-center gap-2 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
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
          <UButton icon="i-heroicons-ellipsis-vertical" variant="" size="sm" />
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

.layer-item {
  transition: transform 0.2s ease;
}
</style>
