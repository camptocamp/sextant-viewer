<script setup lang="ts">
import { useLayerManagement } from '@/composables/useLayerManagement'

const { dataLayers, getMenuItems, getLabel,  handleDeleteLayer} = useLayerManagement()
</script>

<template>
  <div class="layer-manager">
    <!-- Header -->
    <h3 class="my-2 px-3 text-lg font-semibold">Layers</h3>

    <!-- Empty State -->
    <UEmpty
      v-if="dataLayers.length === 0"
      icon="i-heroicons-queue-list"
      message="No layers added"
      description="Add layers to the map to see them here"
    />

    <!-- Layer List -->
    <div v-else class="">
      <div
        v-for="(layer, index) in dataLayers"
        :key="layer.id || `layer-${index}`"
        class="flex items-center py-1 gap-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <UIcon name="i-tabler-stack-2" ></UIcon>
        <!-- Layer Label with Truncation -->
        <UTooltip :text="getLabel(layer)">
          <span class="flex-1 truncate text-sm">
            {{ getLabel(layer) }}
          </span>
        </UTooltip>

        <!-- Context Menu -->
        <UDropdownMenu :items="getMenuItems(layer)">
          <UButton
            icon="i-heroicons-ellipsis-vertical"
            variant="ghost"
            size="xs"
            :disabled="!layer.id"
          />
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-manager {
  min-height: 200px;
}
</style>
