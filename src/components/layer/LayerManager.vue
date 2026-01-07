<script setup lang="ts">
import { useLayerManagement } from '@/composables/useLayerManagement'

const { dataLayers, getMenuItems, getLabel, handleDeleteLayer } = useLayerManagement()
</script>

<template>
  <div class="layer-manager">
    <h3 class="my-2 px-3 text-lg font-semibold">Layers</h3>

    <UEmpty
      v-if="dataLayers.length === 0"
      variant="naked"
      icon="i-heroicons-queue-list"
      message="No layers added"
      description="Add layers to the map to see them here"
    />

    <!-- Layer List -->
    <div v-else class="">
      <div
        v-for="(layer, index) in dataLayers"
        :key="layer.id || `layer-${index}`"
        class="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <UIcon name="i-tabler-stack-2"></UIcon>
        <!-- Layer Label with Truncation -->
        <UTooltip :text="getLabel(layer)">
          <span class="flex-1 truncate text-sm">
            {{ getLabel(layer) }}
          </span>
        </UTooltip>

        <!-- Context Menu -->
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

<style scoped></style>
