<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const { setContext, getContext } = useMapStore()
const { initialContext } = storeToRefs(useMapStore())

const canRestoreInitialContext = computed(() => initialContext.value != undefined)

const restoreInitialContext = () => {
  setContext(initialContext.value)
}

const exportContext = () => {
  const json = JSON.stringify(getContext(), null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: 'map-context.json',
  })
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <UButton
      label="Restaurer le contexte d'origine"
      @click="restoreInitialContext()"
      :disabled="!canRestoreInitialContext"
    />
    <UButton
      label="Exporter le contexte"
      icon="i-heroicons-arrow-down-tray"
      @click="exportContext()"
    />
  </div>
</template>
