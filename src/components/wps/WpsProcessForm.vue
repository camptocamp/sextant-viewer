<script setup lang="ts">
import { computed, watch } from 'vue'
import type { WpsProcessFull, WpsProcessInput, WpsProcessOutput } from '@camptocamp/ogc-client'
import type { WpsFormInputs, WpsFormOutput, WpsInputOccurrence } from '@/types/wps.types'

const props = defineProps<{
  process: WpsProcessFull
  executing: boolean
}>()

const emit = defineEmits<{ execute: [] }>()

const inputs = defineModel<WpsFormInputs>('inputs', { required: true })
const outputs = defineModel<WpsFormOutput[]>('outputs', { required: true })

const WMS_MIMETYPE_REGEX = /ogc-wms|wms/i

function newOccurrence(input: WpsProcessInput): WpsInputOccurrence {
  if (input.type === 'literal' && input.literalData?.defaultValue) {
    return { literalValue: input.literalData.defaultValue }
  }
  return {}
}

function occurrenceIsEmpty(occurrence: WpsInputOccurrence) {
  return !occurrence.literalValue && !occurrence.complexContent && !occurrence.bboxValue
}

function outputFormats(processOutput: WpsProcessOutput) {
  return processOutput.complexData?.supported.map((format) => format.mimeType) ?? []
}

function defaultFormOutput(processOutput: WpsProcessOutput): WpsFormOutput {
  const formats = outputFormats(processOutput)
  const mimeType =
    formats.find((format) => WMS_MIMETYPE_REGEX.test(format)) ??
    processOutput.complexData?.default.mimeType ??
    formats[0]
  return {
    identifier: processOutput.identifier,
    mimeType,
    asReference: mimeType ? WMS_MIMETYPE_REGEX.test(mimeType) : false,
  }
}

function initForm(process: WpsProcessFull) {
  const initialInputs: WpsFormInputs = {}
  for (const input of process.inputs) {
    const count = Math.max(input.minOccurs, 1)
    initialInputs[input.identifier] = Array.from({ length: count }, () => newOccurrence(input))
  }
  inputs.value = initialInputs
  outputs.value = process.outputs.map(defaultFormOutput)
}

watch(() => props.process, initForm, { immediate: true })

const outputsWithChoice = computed(() =>
  props.process.outputs.filter((output) => outputFormats(output).length > 1),
)

function outputMimeTypeFor(identifier: string) {
  return outputs.value.find((output) => output.identifier === identifier)?.mimeType
}

function setOutputMimeType(identifier: string, mimeType?: string) {
  outputs.value = outputs.value.map((output) =>
    output.identifier === identifier
      ? {
          ...output,
          mimeType,
          asReference: mimeType ? WMS_MIMETYPE_REGEX.test(mimeType) : false,
        }
      : output,
  )
}

const isValid = computed(() =>
  props.process.inputs.every((input) => {
    const filled = (inputs.value[input.identifier] ?? []).filter(
      (occurrence) => !occurrenceIsEmpty(occurrence),
    ).length
    return filled >= input.minOccurs
  }),
)

function canAdd(input: WpsProcessInput) {
  return (inputs.value[input.identifier]?.length ?? 0) < input.maxOccurs
}

function canRemove(input: WpsProcessInput) {
  return (inputs.value[input.identifier]?.length ?? 0) > Math.max(input.minOccurs, 1)
}

function setOccurrence(identifier: string, index: number, value: WpsInputOccurrence) {
  const list = [...(inputs.value[identifier] ?? [])]
  list[index] = value
  inputs.value = { ...inputs.value, [identifier]: list }
}

function addOccurrence(input: WpsProcessInput) {
  const list = [...(inputs.value[input.identifier] ?? []), newOccurrence(input)]
  inputs.value = { ...inputs.value, [input.identifier]: list }
}

function removeOccurrence(identifier: string, index: number) {
  const list = (inputs.value[identifier] ?? []).filter((_, i) => i !== index)
  inputs.value = { ...inputs.value, [identifier]: list }
}
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-semibold">Paramètres d'entrée</h4>
    <UFormField
      v-for="input in process.inputs"
      :key="input.identifier"
      :label="input.title || input.identifier"
      :required="input.minOccurs > 0"
      :help="input.abstract"
    >
      <div class="space-y-2">
        <div
          v-for="(occurrence, index) in inputs[input.identifier]"
          :key="index"
          class="flex items-start gap-2"
        >
          <WpsInputField
            :input="input"
            :model-value="occurrence"
            class="flex-1"
            @update:model-value="(value) => setOccurrence(input.identifier, index, value)"
          />
          <UButton
            v-if="canRemove(input)"
            icon="i-heroicons-minus"
            color="neutral"
            variant="ghost"
            @click="removeOccurrence(input.identifier, index)"
          />
        </div>
        <UButton
          v-if="canAdd(input)"
          size="xs"
          variant="soft"
          color="neutral"
          icon="i-heroicons-plus"
          label="Ajouter une valeur"
          @click="addOccurrence(input)"
        />
      </div>
    </UFormField>

    <div v-if="outputsWithChoice.length" class="space-y-2">
      <h4 class="text-sm font-semibold">Format des sorties</h4>
      <UFormField
        v-for="processOutput in outputsWithChoice"
        :key="processOutput.identifier"
        :label="processOutput.title || processOutput.identifier"
      >
        <USelect
          :model-value="outputMimeTypeFor(processOutput.identifier)"
          :items="outputFormats(processOutput)"
          class="w-full"
          @update:model-value="(value) => setOutputMimeType(processOutput.identifier, value)"
        />
      </UFormField>
    </div>

    <UButton
      label="Exécuter"
      icon="i-heroicons-play"
      :loading="executing"
      :disabled="!isValid || executing"
      @click="emit('execute')"
    />
  </div>
</template>
