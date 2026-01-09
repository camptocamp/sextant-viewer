<script setup lang="ts">
const tabItems = [
  { slot: 'list', label: 'List' },
  { slot: 'tree', label: 'Tree' },
]
</script>

<template>
  <UTabs :items="tabItems" :ui="{ content: 'mt-3' }">
    <template #list>
      <LayerManager />
    </template>

    <template #tree>
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-rectangle-group" class="mx-auto mb-2 h-12 w-12 opacity-50" />
        <p class="text-sm">Tree view coming soon</p>
      </div>
    </template>
  </UTabs>
</template>
