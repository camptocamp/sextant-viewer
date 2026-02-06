<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { computed } from 'vue'

const mapStore = useMapStore()

const handleResetContext = () => {
  mapStore.resetContext()
}

const isDisabled = computed(() => {
  return mapStore.sessionContext === null
})
</script>

<template>
  <div class="text-center">
    <UButton
      label="Restaurer le contexte d'origine"
      @click="handleResetContext"
      :disabled="isDisabled"
    />
  </div>
</template>
