<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const { setContext } = useMapStore()
const { initialContext } = storeToRefs(useMapStore())

const canRestoreInitialContext = computed(() => initialContext.value != undefined)

const restoreInitialContext = () => {
  setContext(initialContext.value)
}
</script>

<template>
  <div class="text-center">
    <UButton
      label="Restaurer le contexte d'origine"
      @click="restoreInitialContext()"
      :disabled="!canRestoreInitialContext"
    />
  </div>
</template>
