<script setup lang="ts">
const tabItems = [
  { slot: 'list', label: 'Liste' },
  { slot: 'tree', label: 'Arbre' },
  { slot: 'tools', label: 'Outils' },
  { slot: 'add', label: 'Ajout de données' },
]
</script>

<template>
  <UTabs :items="tabItems" :ui="{ content: 'mt-3 h-full' }" class="sxt-panel">
    <template #list>
      <LayerManager />
    </template>

    <template #tree>
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-rectangle-group" class="mx-auto mb-2 h-12 w-12 opacity-50" />
        <p class="text-sm">Tree view coming soon</p>
      </div>
    </template>
    <template #tools>
      <ToolsPanel />
    </template>
    <template #add>
      <AddDataPanel />
    </template>
  </UTabs>
</template>
