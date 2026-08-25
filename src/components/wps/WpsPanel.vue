<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useWpsProcess } from '@/composables/useWpsProcess'
import { useMapStore } from '@/stores/map.store'

const { wpsServices } = storeToRefs(useMapStore())

const {
  processes,
  selectedProcessId,
  selectedProcess,
  formInputs,
  formOutputs,
  loading,
  describing,
  executing,
  error,
  result,
  outputs,
  resultStage,
  loadService,
  loadProcess,
  runExecute,
} = useWpsProcess()

// Free-text URL: nothing is preselected. The WPS services declared on the map context are
// offered in a dropdown that fills the field and loads the capabilities on selection.
const url = ref('')

const serviceItems = computed(() =>
  wpsServices.value.map((service) => ({ label: service.label ?? service.url, value: service.url })),
)

const processItems = computed(() =>
  processes.value.map((process) => ({
    label: process.title || process.identifier,
    value: process.identifier,
  })),
)

function onServiceSelect(serviceUrl: string) {
  url.value = serviceUrl
  loadService(url.value)
}

const resultSection = ref<HTMLElement | null>(null)

watch(resultStage, async (stage) => {
  if (!stage) return
  await nextTick()
  resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
</script>

<template>
  <div class="flex flex-col gap-4 p-2">
    <section class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">Service WPS</h3>
      <USelect
        v-if="serviceItems.length"
        :model-value="undefined"
        :items="serviceItems"
        value-key="value"
        aria-label="Services WPS prédéfinis"
        placeholder="Services prédéfinis"
        class="w-full"
        :ui="{ content: 'z-50' }"
        @update:model-value="onServiceSelect($event)"
      />
      <UFieldGroup class="w-full">
        <UInput
          v-model="url"
          aria-label="URL du service WPS"
          placeholder="https://..."
          class="flex-1"
        />
        <UButton label="Charger" :loading="loading" :disabled="!url" @click="loadService(url)" />
      </UFieldGroup>
    </section>

    <section v-if="processes.length" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">Traitement</h3>
      <USelect
        :model-value="selectedProcessId"
        :items="processItems"
        value-key="value"
        aria-label="Traitement"
        placeholder="Choisir un traitement"
        class="w-full"
        :ui="{ content: 'z-50' }"
        @update:model-value="loadProcess($event)"
      />
    </section>

    <div v-if="describing" class="text-sm text-gray-500 dark:text-gray-400">
      Chargement de la description…
    </div>

    <section v-if="selectedProcess" class="flex flex-col gap-2">
      <WpsProcessForm
        v-model:inputs="formInputs"
        v-model:outputs="formOutputs"
        :process="selectedProcess"
        :executing="executing"
        @execute="runExecute()"
      />
    </section>

    <div ref="resultSection">
      <WpsExecuteResult :result="result" :error="error" :outputs="outputs" />
    </div>
  </div>
</template>
