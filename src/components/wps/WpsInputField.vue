<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { WpsProcessInput, WpsInputOccurrence } from '@/types/wps.types'
import {
  isBooleanInput,
  isNativeTemporalValue,
  parseBbox,
  parseBooleanLiteral,
  temporalInputType,
} from '@/utils/wps.utils'

const props = defineProps<{
  input: WpsProcessInput
}>()

const model = defineModel<WpsInputOccurrence>({ required: true })

const mapStore = useMapStore()

const allowedValues = computed(() => props.input.literalData?.allowedValues ?? [])

const literalValue = computed({
  get: () => model.value.literalValue ?? '',
  set: (value: string) => (model.value = { ...model.value, literalValue: value }),
})

const isNumber = computed(() =>
  /float|double|int|long|decimal|number/i.test(props.input.literalData?.dataType ?? ''),
)

const fieldType = computed(() => {
  const temporal = temporalInputType(props.input)
  // A server default the native widget cannot display (a trailing 'Z' or a UTC offset, which
  // datetime-local refuses) would leave the field blank on screen while the value stays in the
  // form state and still gets sent. Falling back to text keeps what is shown and what is sent
  // the same thing.
  if (temporal && isNativeTemporalValue(temporal, literalValue.value)) return temporal
  return isNumber.value ? 'number' : 'text'
})

const isBoolean = computed(() => isBooleanInput(props.input))

// An optional boolean must stay omittable: a checkbox has no "unset" state, so it would show
// "Non" while the request drops the input and the process applies its own default — which may
// well be true. The three-way select says what will actually be sent.
const isOptionalBoolean = computed(() => isBoolean.value && props.input.minOccurs === 0)

// Reka UI reserves the empty string for "no selection" and refuses it on a <SelectItem>, so the
// unset entry carries a sentinel and the bound value falls back to '' — which shows the
// placeholder, whose text is that same entry.
const UNSET = 'unset'

const BOOLEAN_ITEMS = [
  { label: 'Non renseigné', value: UNSET },
  { label: 'Oui', value: 'true' },
  { label: 'Non', value: 'false' },
]

const booleanValue = computed(() => parseBooleanLiteral(model.value.literalValue) ?? false)

// UCheckbox emits `boolean | 'indeterminate'`; only a real boolean is a value to store.
function setBoolean(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') literalValue.value = String(value)
}

// Reading through parseBooleanLiteral normalises what the server declared: a 'True' or '1'
// defaultValue must select "Oui", not fall back to "Non renseigné".
const tristateValue = computed({
  get: () => {
    const parsed = parseBooleanLiteral(model.value.literalValue)
    return parsed === undefined ? '' : String(parsed)
  },
  set: (value: string) => (literalValue.value = value === UNSET ? '' : value),
})

const complexContent = computed({
  get: () => model.value.complexContent ?? '',
  set: (value: string) => (model.value = { ...model.value, complexContent: value }),
})

const bboxValue = computed({
  get: () => model.value.bboxValue ?? '',
  set: (value: string) => (model.value = { ...model.value, bboxValue: value }),
})

// A blank field is unfilled, not wrong — only a non-empty, unparsable bbox is an error worth
// showing. Without it, the disabled "Exécuter" button has no visible cause.
const bboxIsInvalid = computed(() => !!bboxValue.value && !parseBbox(bboxValue.value))

function useMapExtent() {
  const extent = mapStore.currentExtent
  if (extent) {
    bboxValue.value = extent.map((n) => n.toFixed(6)).join(',')
  }
}
</script>

<template>
  <div>
    <template v-if="input.type === 'literal'">
      <USelect
        v-if="isOptionalBoolean"
        v-model="tristateValue"
        :items="BOOLEAN_ITEMS"
        value-key="value"
        placeholder="Non renseigné"
        class="w-full"
        :ui="{ content: 'z-50' }"
      />
      <!-- Before allowedValues: a server enumerating ['true','false'] still deserves a checkbox. -->
      <UCheckbox
        v-else-if="isBoolean"
        :model-value="booleanValue"
        :label="booleanValue ? 'Oui' : 'Non'"
        @update:model-value="setBoolean"
      />
      <USelect
        v-else-if="allowedValues.length"
        v-model="literalValue"
        :items="allowedValues"
        class="w-full"
        :ui="{ content: 'z-50' }"
      />
      <UInput v-else v-model="literalValue" :type="fieldType" class="w-full" />
    </template>

    <template v-else-if="input.type === 'boundingbox'">
      <UFieldGroup class="w-full">
        <UInput
          v-model="bboxValue"
          placeholder="minX,minY,maxX,maxY"
          class="flex-1"
          :color="bboxIsInvalid ? 'error' : undefined"
          :highlight="bboxIsInvalid"
        />
        <UButton
          icon="i-heroicons-map"
          color="neutral"
          variant="subtle"
          title="Utiliser l'emprise de la carte"
          @click="useMapExtent()"
        />
      </UFieldGroup>
      <p v-if="bboxIsInvalid" class="text-error mt-1 text-xs">
        Attendu : quatre nombres, minX,minY,maxX,maxY
      </p>
    </template>

    <UTextarea
      v-else-if="input.type === 'complex'"
      v-model="complexContent"
      :rows="4"
      placeholder="Coller du GeoJSON, WKT ou GML…"
      class="w-full"
    />
  </div>
</template>
