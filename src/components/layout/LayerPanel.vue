<script setup lang="ts">
import LayerDetailsPanel from '@/components/layout/LayerDetailsPanel.vue'
import { useLayersStore } from '@/stores/layers.store.ts'
import { storeToRefs } from 'pinia'

const { selectedLayer } = storeToRefs(useLayersStore())

const tabItems = [
  { slot: 'list', label: 'List' },
  { slot: 'tree', label: 'Tree' },
]
</script>

<template>
  <UTabs :items="tabItems" :ui="{ content: 'mt-3 h-full' }" class="sxt-panel">
    <template #list>
      <div class="flex flex-col gap-2">
        <LayerManager />
        <div v-if="selectedLayer">
          <USeparator icon="i-tabler-stack-2-filled" />
          <LayerDetailsPanel :layer="selectedLayer" />
        </div>
      </div>
    </template>

    <template #tree>
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-rectangle-group" class="mx-auto mb-2 h-12 w-12 opacity-50" />
        <p class="text-sm">Tree view coming soon</p>
      </div>
    </template>
  </UTabs>
</template>
