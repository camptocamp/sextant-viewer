<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { DEFAULT_MAP_CONTEXT } from '@/utils/map-config'
import { computed, toRaw } from 'vue'

const mapStore = useMapStore()

const handleResetContext = () => {
  mapStore.resetContext()
}

const isDisabled = computed(() => {
  if (!mapStore.sessionContext) {
    return true
  }
  return toRaw(mapStore.sessionContext) === DEFAULT_MAP_CONTEXT
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
