<script setup lang="ts">
import { LAYOUT } from '@/constants/layout'
import LayerPanel from './LayerPanel.vue'

const gridTemplateColumns = `${LAYOUT.LAYER_PANEL_WIDTH}px ${LAYOUT.MIDDLE_PANEL_WIDTH}px minmax(${LAYOUT.MAP_MIN_WIDTH}px, 1fr) ${LAYOUT.RIGHT_PANEL_WIDTH}px`
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-10 grid gap-2 p-2 *:pointer-events-auto"
    :style="{ gridTemplateColumns }"
  >
    <LayerPanel />
  </div>
</template>

<style scoped></style>
