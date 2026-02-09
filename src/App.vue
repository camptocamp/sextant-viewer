<script setup lang="ts">
import LayoutGrid from '@/components/layout/LayoutGrid.vue'
import { usePersistentContextStore } from '@/stores/persistentContext.store'

usePersistentContextStore()
</script>

<template>
  <UApp class="relative">
    <MapViewer />
    <LayoutGrid />
  </UApp>
</template>
