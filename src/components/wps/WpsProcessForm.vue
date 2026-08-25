<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import type { WpsProcessFull, WpsProcessInput, WpsProcessOutput } from '@camptocamp/ogc-client'
import type {
  WpsApplicationProfile,
  WpsFormInputs,
  WpsFormOutput,
  WpsInputOccurrence,
} from '@/types/wps.types'
import {
  cardinalityLabel,
  isBooleanInput,
  occurrenceHasContent,
  parseBooleanLiteral,
  toInputValue,
} from '@/utils/wps.utils'
import { applyProfile, profileOutputMimeType } from '@/utils/wps-profile.utils'
import WpsInputField from './WpsInputField.vue'

const props = defineProps<{
  process: WpsProcessFull
  executing: boolean
  /** Declarative customisation from the layer's metadata record; absent in the global panel. */
  profile?: WpsApplicationProfile
  /** The layer's active filter selections, keyed by column — what `linkedWfsFilter` addresses. */
  linkedFilters?: Record<string, string[]>
}>()

const emit = defineEmits<{ execute: [] }>()

const inputs = defineModel<WpsFormInputs>('inputs', { required: true })
const outputs = defineModel<WpsFormOutput[]>('outputs', { required: true })

const WMS_MIMETYPE_REGEX = /ogc-wms|wms/i

function newOccurrence(input: WpsProcessInput): WpsInputOccurrence {
  if (input.type !== 'literal') return {}
  const defaultValue = input.literalData?.defaultValue
  if (isBooleanInput(input)) {
    const initial = parseBooleanLiteral(defaultValue)
    if (initial !== undefined) return { literalValue: String(initial) }
    // A checkbox has no empty state, so a required boolean starts explicitly false — otherwise
    // the form shows an unchecked box while `isValid` counts the occurrence as missing. An
    // optional one starts unset, which its tri-state select displays as such.
    return input.minOccurs > 0 ? { literalValue: 'false' } : {}
  }
  return defaultValue ? { literalValue: defaultValue } : {}
}

function outputFormats(processOutput: WpsProcessOutput) {
  return processOutput.complexData?.supported.map((format) => format.mimeType) ?? []
}

/**
 * Formats offered for an output. A `defaultMimeType` the service does not advertise is offered
 * anyway — the legacy client validated nothing against `supported`, and it does get sent — but
 * labelled, rather than leaving a control that reads as empty.
 */
function outputItems(processOutput: WpsProcessOutput) {
  const formats = outputFormats(processOutput)
  const items = formats.map((format) => ({ label: format, value: format }))
  const fromProfile = profileOutputMimeType(props.profile, processOutput.identifier)
  if (fromProfile && !formats.includes(fromProfile)) {
    items.unshift({ label: `${fromProfile} — non annoncé par le service`, value: fromProfile })
  }
  return items
}

// Single parameter on purpose: `initForm` maps it point-free over the outputs, so a second one
// would receive the index.
function defaultFormOutput(processOutput: WpsProcessOutput): WpsFormOutput {
  const formats = outputFormats(processOutput)
  const mimeType =
    formats.find((format) => WMS_MIMETYPE_REGEX.test(format)) ??
    profileOutputMimeType(props.profile, processOutput.identifier) ??
    processOutput.complexData?.default.mimeType ??
    formats[0]
  return {
    identifier: processOutput.identifier,
    selected: true,
    mimeType,
    asReference: mimeType ? WMS_MIMETYPE_REGEX.test(mimeType) : false,
  }
}

// Inputs the profile hides (their value is still sent) and inputs the layer filter imposes a value
// for. Written by initForm alone, so they always describe the form as it currently stands.
const hiddenInputs = ref(new Set<string>())
const overriddenInputs = ref(new Set<string>())

function initForm(process: WpsProcessFull) {
  const initialInputs: WpsFormInputs = {}
  for (const input of process.inputs) {
    const count = Math.max(input.minOccurs, 1)
    initialInputs[input.identifier] = Array.from({ length: count }, () => newOccurrence(input))
  }
  const applied = applyProfile(process, initialInputs, props.profile, props.linkedFilters ?? {})
  inputs.value = applied.inputs
  hiddenInputs.value = applied.hidden
  overriddenInputs.value = applied.overridden
  outputs.value = process.outputs.map(defaultFormOutput)
}

watch(() => props.process, initForm, { immediate: true })

const visibleInputs = computed(() =>
  props.process.inputs.filter((input) => !hiddenInputs.value.has(input.identifier)),
)

/** An imposed value is not one to edit here: either the filter set it, or the profile froze it. */
function isReadOnly(input: WpsProcessInput) {
  if (overriddenInputs.value.has(input.identifier)) return true
  return !!props.profile?.inputs?.find((entry) => entry.identifier === input.identifier)?.disabled
}

function formOutputFor(identifier: string) {
  return outputs.value.find((output) => output.identifier === identifier)
}

function updateOutput(identifier: string, changes: Partial<WpsFormOutput>) {
  outputs.value = outputs.value.map((output) =>
    output.identifier === identifier ? { ...output, ...changes } : output,
  )
}

function setOutputMimeType(identifier: string, mimeType?: string) {
  updateOutput(identifier, {
    mimeType,
    asReference: mimeType ? WMS_MIMETYPE_REGEX.test(mimeType) : false,
  })
}

// A process that declares no output at all leaves nothing to select, so the requirement only
// applies once there is something to tick.
const hasSelectedOutput = computed(
  () => !props.process.outputs.length || outputs.value.some((output) => output.selected),
)

// Validating through `toInputValue` keeps this predictive of buildExecuteOptions, which is what
// actually decides whether a value reaches the server.
function isInputValid(input: WpsProcessInput) {
  const occurrences = inputs.value[input.identifier] ?? []
  const values = occurrences.map((occurrence) => toInputValue(input, occurrence))
  // A filled field the request builder would drop is a typo, not an omission — refuse it even
  // when the input is optional and minOccurs is already satisfied by definition.
  const hasUnusable = occurrences.some(
    (occurrence, index) => values[index] === null && occurrenceHasContent(occurrence),
  )
  return !hasUnusable && values.filter((value) => value !== null).length >= input.minOccurs
}

// Hidden inputs carry values, so they count normally.
const invalidInputs = computed(() => props.process.inputs.filter((input) => !isInputValid(input)))

const isValid = computed(() => invalidInputs.value.length === 0)

// A hidden required input left empty disables "Exécuter" with nothing on screen to explain it —
// a trap already present in the legacy client. Naming the missing criteria is the way out; when a
// visible field is also invalid, its own error is the one to read.
const missingHiddenInputs = computed(() =>
  invalidInputs.value.length &&
  invalidInputs.value.every((input) => hiddenInputs.value.has(input.identifier))
    ? invalidInputs.value.map((input) => input.title || input.identifier)
    : [],
)

function helpFor(input: WpsProcessInput) {
  if (overriddenInputs.value.has(input.identifier)) {
    return 'Surchargé par le filtre de la couche'
  }
  return [input.abstract, cardinalityLabel(input)].filter(Boolean).join(' — ')
}

// An imposed value is not one to add occurrences to: the filter decides how many there are.
function canAdd(input: WpsProcessInput) {
  if (isReadOnly(input)) return false
  return (inputs.value[input.identifier]?.length ?? 0) < input.maxOccurs
}

function canRemove(input: WpsProcessInput) {
  if (isReadOnly(input)) return false
  return (inputs.value[input.identifier]?.length ?? 0) > Math.max(input.minOccurs, 1)
}

/** Stated only when the profile's format is the one actually selected — otherwise it would lie. */
function outputProvenance(processOutput: WpsProcessOutput) {
  const fromProfile = profileOutputMimeType(props.profile, processOutput.identifier)
  return fromProfile && formOutputFor(processOutput.identifier)?.mimeType === fromProfile
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
    <h4 v-if="visibleInputs.length" class="text-sm font-semibold">Paramètres d'entrée</h4>
    <UFormField
      v-for="input in visibleInputs"
      :key="input.identifier"
      :label="input.title || input.identifier"
      :required="input.minOccurs > 0"
      :help="helpFor(input)"
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
            :disabled="isReadOnly(input)"
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

    <div v-if="process.outputs.length" class="space-y-2">
      <h4 class="text-sm font-semibold">Sorties</h4>
      <div
        v-for="processOutput in process.outputs"
        :key="processOutput.identifier"
        class="space-y-1"
      >
        <UCheckbox
          :model-value="!!formOutputFor(processOutput.identifier)?.selected"
          :label="processOutput.title || processOutput.identifier"
          :description="processOutput.abstract"
          @update:model-value="
            (value) => updateOutput(processOutput.identifier, { selected: value === true })
          "
        />
        <USelect
          v-if="outputItems(processOutput).length > 1"
          :model-value="formOutputFor(processOutput.identifier)?.mimeType"
          :items="outputItems(processOutput)"
          value-key="value"
          :disabled="!formOutputFor(processOutput.identifier)?.selected"
          :aria-label="`Format de ${processOutput.title || processOutput.identifier}`"
          class="ms-6 w-[calc(100%-1.5rem)]"
          :ui="{ content: 'z-50' }"
          @update:model-value="
            (value: string) => setOutputMimeType(processOutput.identifier, value)
          "
        />
        <p v-else-if="outputItems(processOutput).length === 1" class="text-dimmed ms-6 text-xs">
          Format : {{ outputItems(processOutput)[0]!.label }}
        </p>
        <p v-if="outputProvenance(processOutput)" class="text-dimmed ms-6 text-xs">
          Format par défaut issu de la fiche de métadonnées
        </p>
      </div>
      <p v-if="!hasSelectedOutput" class="text-error text-xs">Sélectionnez au moins une sortie.</p>
    </div>

    <UAlert
      v-if="missingHiddenInputs.length"
      color="warning"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="`Critère requis non renseigné : ${missingHiddenInputs.join(', ')}`"
      description="Cette valeur provient du filtre de la couche — sélectionnez-la dans l'onglet « Filtre »."
    />

    <UButton
      label="Exécuter"
      icon="i-heroicons-play"
      :loading="executing"
      :disabled="!isValid || !hasSelectedOutput || executing"
      @click="emit('execute')"
    />
  </div>
</template>
