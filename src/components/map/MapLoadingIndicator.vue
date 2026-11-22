<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { useLayerLoadingState } from '@/composables/useLayerLoadingState'

const mapStore = useMapStore()
const { isLoading } = useLayerLoadingState(() => mapStore.olMap)
</script>

<template>
  <Transition name="fade">
    <UProgress v-if="isLoading" size="sm" class="absolute top-0 left-0 z-10 w-full" />
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
