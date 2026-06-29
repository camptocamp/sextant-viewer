<script setup lang="ts">
import { ref } from 'vue'

const tabItems = [
  { slot: 'list', label: 'Liste', value: 'list' },
  { slot: 'tree', label: 'Arbre', value: 'tree' },
  { slot: 'tools', label: 'Outils', value: 'tools' },
  { slot: 'add', label: 'Ajout de données', value: 'add' },
]

const activeTab = ref('list')
</script>

<template>
  <UTabs
    v-model="activeTab"
    :items="tabItems"
    :ui="{ root: 'flex min-h-0 flex-col', content: 'mt-3 min-h-0 flex-1 overflow-auto' }"
    class="sxt-panel"
  >
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
      <AddDataPanel @layer-added="activeTab = 'list'" />
    </template>
  </UTabs>
</template>
