<script setup lang="ts">
import { ref } from 'vue'

const tabItems = [
  { slot: 'list', label: 'Couches', value: 'list' },
  { slot: 'tools', label: 'Outils', value: 'tools' },
  { slot: 'add', label: 'Ajout de données', value: 'add' },
  { slot: 'wps', label: 'Traitements', value: 'wps' },
]

const activeTab = ref('list')
</script>

<template>
  <UTabs
    v-model="activeTab"
    :items="tabItems"
    :unmount-on-hide="false"
    :ui="{ root: 'flex min-h-0 flex-col', content: 'mt-3 min-h-0 flex-1 overflow-auto' }"
    class="sxt-panel"
  >
    <template #list>
      <LayerManager />
    </template>

    <template #tools>
      <ToolsPanel />
    </template>

    <template #add>
      <AddDataPanel @layer-added="activeTab = 'list'" />
    </template>
    <template #wps>
      <WpsPanel />
    </template>
  </UTabs>
</template>
