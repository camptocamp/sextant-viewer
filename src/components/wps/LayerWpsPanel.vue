<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useWpsProcess } from '@/composables/useWpsProcess'
import { hasLayerWps, type MapLayer } from '@/utils/layer.utils'
import { activeFiltersOf } from '@/utils/wms.utils'
import type { LayerWpsProcess } from '@/types/wps.types'

const props = defineProps<{ layer: MapLayer }>()

const {
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
  selectProcess,
  runExecute,
} = useWpsProcess()

const declaredProcesses = computed<LayerWpsProcess[]>(() =>
  hasLayerWps(props.layer) ? (props.layer.extras?.wpsProcesses ?? []) : [],
)

const processItems = computed(() =>
  declaredProcesses.value.map((process) => ({
    label: process.label ?? process.processId,
    // A record may declare the same process id on two services, so the index is the identity here.
    value: process.processId,
  })),
)

const chosenProcessId = ref<string>()

const chosenProcess = computed(() =>
  declaredProcesses.value.find((process) => process.processId === chosenProcessId.value),
)

/**
 * The layer filter is read, never written: the profile's `linkedWfsFilter` names the columns the
 * user selected in the "Filtre" tab. No filter simply means the process keeps its own defaults.
 */
const linkedFilters = computed(() => activeFiltersOf(props.layer))

async function choose(processId: string | undefined) {
  chosenProcessId.value = processId
  const process = declaredProcesses.value.find((entry) => entry.processId === processId)
  if (!process) return
  await loadService(process.url)
  await selectProcess(process.processId)
}

// Another layer means another filter and another profile, so its choice is made from scratch —
// re-selecting even a process id the previous layer also declared, which is what re-initialises the
// form on the new layer's values.
watch(
  () => props.layer.id,
  () => choose(declaredProcesses.value[0]?.processId),
  { immediate: true },
)

// The layer's processes arrive from a background detection: the first one becomes the offer as soon
// as it is known, without disturbing a choice the user has already made.
watch(declaredProcesses, () => {
  if (chosenProcess.value) return
  choose(declaredProcesses.value[0]?.processId)
})

const resultSection = ref<HTMLElement | null>(null)

watch(resultStage, async (stage) => {
  if (!stage) return
  await nextTick()
  resultSection.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-if="processItems.length > 1" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">Traitement</h3>
      <USelect
        :model-value="chosenProcessId"
        :items="processItems"
        value-key="value"
        aria-label="Traitement de la couche"
        placeholder="Choisir un traitement"
        class="w-full"
        :ui="{ content: 'z-50' }"
        @update:model-value="choose($event)"
      />
    </section>

    <div v-if="loading || describing" class="text-dimmed text-sm">
      Chargement de la description…
    </div>

    <WpsProcessForm
      v-if="selectedProcess"
      v-model:inputs="formInputs"
      v-model:outputs="formOutputs"
      :process="selectedProcess"
      :executing="executing"
      :profile="chosenProcess?.profile"
      :linked-filters="linkedFilters"
      @execute="runExecute()"
    />

    <div ref="resultSection">
      <WpsExecuteResult :result="result" :error="error" :outputs="outputs" />
    </div>
  </div>
</template>
