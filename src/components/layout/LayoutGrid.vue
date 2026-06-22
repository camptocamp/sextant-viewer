<script setup lang="ts">
import LayerPanel from './LayerPanel.vue'
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-10 grid grid-cols-[400px_440px_minmax(900px,1fr)_200px] grid-rows-[minmax(0,1fr)] gap-2 p-2 *:pointer-events-auto"
  >
    <LayerPanel />
  </div>
</template>

<style scoped></style>
