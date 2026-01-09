<script setup lang="ts">
import LayerPanel from './LayerPanel.vue'
import LayerDetailsPanel from './LayerDetailsPanel.vue'
import { storeToRefs } from 'pinia'
import { useLayersStore } from '@/stores/layers.store.ts'

const { selectedLayer } = storeToRefs(useLayersStore())
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-10 grid grid-cols-[400px_440px_minmax(900px,_1fr)_200px] gap-2 p-2 *:pointer-events-auto *:bg-white/50 *:backdrop-blur-sm"
  >
    <LayerPanel class="" />
    <Transition name="panel" mode="out-in">
      <LayerDetailsPanel v-if="selectedLayer" :layer="selectedLayer" />
    </Transition>
  </div>
</template>

<style scoped></style>
