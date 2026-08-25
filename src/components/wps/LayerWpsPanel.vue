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
  runExecute,
} = useWpsProcess()

const declaredProcesses = computed<LayerWpsProcess[]>(() =>
  hasLayerWps(props.layer) ? (props.layer.extras?.wpsProcesses ?? []) : [],
)

const processItems = computed(() =>
  declaredProcesses.value.map((process, index) => ({
    label: process.label ?? process.processId,
    // A record may declare the same process id on two services, so the position in the list is the
    // only identity that tells the two entries — and their services and profiles — apart.
    value: index,
  })),
)

const chosenIndex = ref<number>()

const chosenProcess = computed(() =>
  chosenIndex.value === undefined ? undefined : declaredProcesses.value[chosenIndex.value],
)

/**
 * The layer filter is read, never written: the profile's `linkedWfsFilter` names the columns the
 * user selected in the "Filtre" tab. No filter simply means the process keeps its own defaults.
 */
const linkedFilters = computed(() => activeFiltersOf(props.layer))

// `chosenIndex` is written before the first await, so the select and the profile handed to the form
// always stand for the last choice made, whichever load resolves last.
async function choose(index: number | undefined) {
  chosenIndex.value = index
  const process = chosenProcess.value
  if (!process) return
  await loadService(process.url, process.processId)
}

function firstIndex() {
  return declaredProcesses.value.length ? 0 : undefined
}

// Another layer means another filter and another profile, so its choice is made from scratch —
// re-selecting even a process id the previous layer also declared, which is what re-initialises the
// form on the new layer's values.
watch(
  () => props.layer.id,
  () => choose(firstIndex()),
  { immediate: true },
)

// The layer's processes arrive from a background detection: the first one becomes the offer as soon
// as it is known, without disturbing a choice the user has already made.
watch(declaredProcesses, () => {
  if (chosenProcess.value) return
  choose(firstIndex())
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
        :model-value="chosenIndex"
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
