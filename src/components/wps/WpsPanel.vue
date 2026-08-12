<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
import {
  buildExecuteOptions,
  classifyOutput,
  describeProcess,
  executeProcess,
  loadProcesses,
} from '@/utils/wps.utils'

const { addOutputsToMap } = useWps()

const { wpsServices } = storeToRefs(useMapStore())

// Free-text URL: nothing is preselected. The WPS services declared on the map context are
// offered in a dropdown that fills the field and loads the capabilities on selection.
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

const resultSection = ref<HTMLElement | null>(null)

// Derived state rather than `result` itself: the progress callback reassigns `result` on every
// poll, which would re-scroll continuously while the process is still running.
const resultStage = computed(() => {
  if (error.value) return 'error'
  if (!result.value) return null
  return ['succeeded', 'failed'].includes(result.value.status) ? 'done' : 'pending'
})

watch(resultStage, async (stage) => {
  if (!stage) return
  await nextTick()
  resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

// A poll that outlives what it was started for would keep writing into `result`, for a process
// the panel has already moved on from.
let poll: AbortController | null = null

function stopPolling() {
  poll?.abort()
  poll = null
}

onBeforeUnmount(stopPolling)

function reset() {
  stopPolling()
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

function onServiceSelect(serviceUrl: string) {
  url.value = serviceUrl
  load()
}

watch(selectedProcessId, async (processId) => {
  stopPolling()
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
  const process = selectedProcess.value
  executing.value = true
  error.value = null
  result.value = null
  outputs.value = []
  try {
    const options = buildExecuteOptions(process, formInputs.value, formOutputs.value)
    poll = new AbortController()
    const response = await executeProcess(endpoint.value, process.identifier, options, {
      // Progress only: the terminal response is assigned below, in the same tick as its outputs,
      // so the result block never renders half of itself.
      onProgress: (pending) => {
        if (!['succeeded', 'failed'].includes(pending.status)) result.value = pending
      },
      signal: poll.signal,
    })
    result.value = response
    outputs.value = response.status === 'succeeded' ? response.outputs.map(classifyOutput) : []
  } catch (e) {
    // An abort is the panel's own doing: it has already moved on, and reported nothing to fix.
    if ((e as Error).name === 'AbortError') return
    const msg = `Failed to execute process "${process.identifier}"`
    console.error(msg, e)
    error.value = `${msg}: ${(e as Error).message}`
    return
  } finally {
    executing.value = false
  }

  await addOutputsToMap(outputs.value, (previous, updated) => {
    outputs.value = outputs.value.map((o) => (o === previous ? updated : o))
  })
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
        @update:model-value="onServiceSelect($event)"
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
        :ui="{ content: 'z-50' }"
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

    <div ref="resultSection">
      <WpsExecuteResult :result="result" :error="error" :outputs="outputs" />
    </div>
  </div>
</template>
