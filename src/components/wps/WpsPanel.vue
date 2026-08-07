<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type {
  WpsEndpoint,
  WpsProcessSummary,
  WpsProcessFull,
  WpsExecuteResponse,
} from '@camptocamp/ogc-client'
import { useWps } from '@/composables/useWps'
import { useMapStore } from '@/stores/map.store'
import type { WpsFormInputs, WpsFormOutput, WpsOutputResult } from '@/types/wps.types'
import { buildExecuteOptions, describeProcess, loadProcesses } from '@/utils/wps.utils'

const { execute } = useWps()

const emit = defineEmits<{ 'layer-added': [] }>()

const { wpsServices } = storeToRefs(useMapStore())

// Free-text URL: nothing is preselected. The WPS services declared on the map context are
// offered in a dropdown that fills the field on selection.
const url = ref('')

const serviceItems = computed(() =>
  wpsServices.value.map((service) => ({ label: service.label ?? service.url, value: service.url })),
)

const endpoint = shallowRef<WpsEndpoint | null>(null)
const processes = ref<WpsProcessSummary[]>([])
const selectedProcessId = ref<string>()
const selectedProcess = ref<WpsProcessFull | null>(null)

const formInputs = ref<WpsFormInputs>({})
const formOutputs = ref<WpsFormOutput[]>([])

const loading = ref(false)
const describing = ref(false)
const executing = ref(false)
const error = ref<string | null>(null)
const result = ref<WpsExecuteResponse | null>(null)
const outputs = ref<WpsOutputResult[]>([])

const processItems = computed(() =>
  processes.value.map((process) => ({
    label: process.title || process.identifier,
    value: process.identifier,
  })),
)

function reset() {
  endpoint.value = null
  processes.value = []
  selectedProcessId.value = undefined
  selectedProcess.value = null
  result.value = null
  error.value = null
}

async function load() {
  reset()
  loading.value = true
  try {
    const loaded = await loadProcesses(url.value)
    endpoint.value = loaded.endpoint
    processes.value = loaded.processes
  } catch (e) {
    const msg = `Failed to load processes from URL ${url.value}`
    console.error(msg, e)
    error.value = `${msg}: ${(e as Error).message}`
  } finally {
    loading.value = false
  }
}

watch(selectedProcessId, async (processId) => {
  selectedProcess.value = null
  result.value = null
  error.value = null
  if (!endpoint.value || !processId) return
  describing.value = true
  try {
    selectedProcess.value = await describeProcess(endpoint.value, processId)
  } catch (e) {
    const msg = `Failed to describe process "${processId}"`
    console.error(msg, e)
    error.value = `${msg}: ${(e as Error).message}`
  } finally {
    describing.value = false
  }
})

async function onExecute() {
  if (!endpoint.value || !selectedProcess.value) return
  executing.value = true
  error.value = null
  result.value = null
  outputs.value = []
  try {
    const options = buildExecuteOptions(selectedProcess.value, formInputs.value, formOutputs.value)
    const outcome = await execute(
      endpoint.value,
      selectedProcess.value.identifier,
      options,
      (response) => (result.value = response),
    )
    result.value = outcome.response
    outputs.value = outcome.outputs
    if (outcome.outputs.some((o) => o.kind === 'wms' || o.kind === 'geojson')) {
      emit('layer-added')
    }
  } catch (e) {
    const msg = `Failed to execute process "${selectedProcess.value?.identifier}"`
    console.error(msg, e)
    error.value = `${msg}: ${(e as Error).message}`
  } finally {
    executing.value = false
  }
}
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
        @update:model-value="url = $event"
      />
      <UFieldGroup class="w-full">
        <UInput
          v-model="url"
          aria-label="URL du service WPS"
          placeholder="https://..."
          class="flex-1"
        />
        <UButton label="Charger" :loading="loading" :disabled="!url" @click="load()" />
      </UFieldGroup>
    </section>

    <section v-if="processes.length" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">Traitement</h3>
      <USelect
        v-model="selectedProcessId"
        :items="processItems"
        aria-label="Traitement"
        placeholder="Choisir un traitement"
        class="w-full"
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
        @execute="onExecute()"
      />
    </section>

    <WpsExecuteResult :result="result" :error="error" :outputs="outputs" />
  </div>
</template>
