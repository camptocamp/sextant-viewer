<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type {
  WpsEndpoint,
  WpsProcessSummary,
  WpsProcessFull,
  WpsExecuteResponse,
} from '@camptocamp/ogc-client'
import { useWps } from '@/composables/useWps'
import type { WpsFormInputs, WpsFormOutput } from '@/types/wps.types'

const { loadProcesses, describe, buildExecuteOptions, execute } = useWps()

const url = ref('https://sextant.ifremer.fr/services/wps3/demo')
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
const addedLayers = ref<string[]>([])

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
    error.value = (e as Error).message
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
    selectedProcess.value = await describe(endpoint.value, processId)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    describing.value = false
  }
})

async function onExecute() {
  if (!endpoint.value || !selectedProcess.value) return
  executing.value = true
  error.value = null
  result.value = null
  addedLayers.value = []
  try {
    const options = buildExecuteOptions(selectedProcess.value, formInputs.value, formOutputs.value)
    const outcome = await execute(
      endpoint.value,
      selectedProcess.value.identifier,
      options,
      (response) => (result.value = response),
    )
    result.value = outcome.response
    addedLayers.value = outcome.addedLayers
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    executing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 p-2">
    <UFormField label="Service WPS">
      <UFieldGroup class="w-full">
        <UInput v-model="url" placeholder="https://..." class="flex-1" />
        <UButton label="Charger" :loading="loading" :disabled="!url" @click="load()" />
      </UFieldGroup>
    </UFormField>

    <UFormField v-if="processes.length" label="Processus">
      <USelect
        v-model="selectedProcessId"
        :items="processItems"
        placeholder="Choisir un processus"
        class="w-full"
      />
    </UFormField>

    <div v-if="describing" class="text-sm text-gray-500 dark:text-gray-400">
      Chargement de la description…
    </div>

    <WpsProcessForm
      v-if="selectedProcess"
      v-model:inputs="formInputs"
      v-model:outputs="formOutputs"
      :process="selectedProcess"
      :executing="executing"
      @execute="onExecute()"
    />

    <WpsExecuteResult :result="result" :error="error" :added-layers="addedLayers" />
  </div>
</template>
