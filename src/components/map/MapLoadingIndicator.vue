<script setup lang="ts">
import type Map from 'ol/Map'
import { inject, type ShallowRef } from 'vue'
import { useLayerLoadingState } from '@/composables/useLayerLoadingState'

const mapRef = inject<ShallowRef<Map | null>>('map')!
const { isLoading } = useLayerLoadingState(mapRef)
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
