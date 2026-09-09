<script setup lang="ts">
import { useMapStore } from '@/stores/map.store'
import { isMapContext } from '@/utils/context.utils'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const { setContext, setInitialContext, getContext } = useMapStore()
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

const importAsInitialContext = ref(false)
const importError = ref<string>()

const importContext = async (file: File | null | undefined) => {
  importError.value = undefined
  if (!file) {
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch (error) {
    console.error('Context import failed', error)
    importError.value = 'Fichier JSON illisible'
    return
  }

  if (!isMapContext(parsed)) {
    importError.value = 'Le fichier ne contient pas un contexte de carte'
    return
  }

  if (importAsInitialContext.value) {
    await setInitialContext(parsed, true)
  } else {
    await setContext(parsed)
  }
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
    <div class="flex flex-col items-center gap-2">
      <UFileUpload
        accept=".json,application/json"
        :dropzone="false"
        reset
        @update:model-value="importContext"
      >
        <template #default="{ open }">
          <UButton label="Importer un contexte" icon="i-heroicons-arrow-up-tray" @click="open()" />
        </template>
      </UFileUpload>
      <UCheckbox v-model="importAsInitialContext" label="Définir comme contexte d'origine" />
      <UAlert
        v-if="importError"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="importError"
      />
    </div>
  </div>
</template>
