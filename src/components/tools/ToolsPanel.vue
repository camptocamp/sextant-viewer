<script setup lang="ts">
import { usePersistentContextStore } from '@/stores/persistentContext.store'
import { storeToRefs } from 'pinia'

const { restoreContext } = usePersistentContextStore()
const { canRestoreContext } = storeToRefs(usePersistentContextStore())
</script>

<template>
  <div class="text-center">
    <UButton
      label="Restaurer le contexte d'origine"
      @click="restoreContext"
      :disabled="!canRestoreContext"
    />
  </div>
</template>
