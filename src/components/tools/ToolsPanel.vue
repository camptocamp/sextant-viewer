<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'

const mapStore = useMapStore()

const handleResetContext = () => {
  mapStore.resetContext()
}
</script>

<template>
  <div class="text-center">
    <UButton label="Restaurer le contexte d'origine" @click="handleResetContext" />
  </div>
</template>
