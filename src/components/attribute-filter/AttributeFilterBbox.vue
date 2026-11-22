<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Extent } from '@geospatial-sdk/core'
import { useBboxDraw } from '@/composables/useBboxDraw'
import { COORDINATE_DECIMALS, MAX_LATITUDE, MAX_LONGITUDE } from '@/utils/geo.utils'
import AttributeFilterSection from './AttributeFilterSection.vue'

const props = defineProps<{ bbox: Extent | undefined }>()

const emit = defineEmits<{ update: [bbox: Extent | null] }>()

const { drawing, toggleDrawing, stopDrawing } = useBboxDraw(
  () => props.bbox,
  (extent) => emit('update', extent),
)

// Collapsing hides the draw button: an armed drawing would then turn the next map pan into an area.
const open = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) stopDrawing()
})

// Extent order, laid out as a compass: north on top, west/east in the middle, south below.
const SIDES = [
  { index: 3, label: 'Nord', class: 'col-start-2' },
  { index: 0, label: 'Ouest', class: 'col-start-1' },
  { index: 2, label: 'Est', class: 'col-start-3' },
  { index: 1, label: 'Sud', class: 'col-start-2' },
] as const

// Edited coordinate by coordinate; the area only applies once all four form a valid box.
const draft = reactive<(number | null)[]>([null, null, null, null])
watch(
  () => props.bbox,
  (bbox) => draft.splice(0, 4, ...(bbox ?? [null, null, null, null])),
  { immediate: true },
)

const complete = computed(() => draft.every((value) => value !== null))

/** Extent indices of the sides to correct: out of the globe, or west/east or south/north swapped. */
const invalidSides = computed(() => {
  const sides = new Set<number>()
  if (!complete.value) return sides
  const [w, s, e, n] = draft as number[]
  if (Math.abs(w!) > MAX_LONGITUDE) sides.add(0)
  if (Math.abs(s!) > MAX_LATITUDE) sides.add(1)
  if (Math.abs(e!) > MAX_LONGITUDE) sides.add(2)
  if (Math.abs(n!) > MAX_LATITUDE) sides.add(3)
  if (w! >= e!) sides.add(0).add(2)
  if (s! >= n!) sides.add(1).add(3)
  return sides
})
const invalid = computed(() => invalidSides.value.size > 0)

function apply() {
  if (!complete.value || invalid.value) return
  const extent = [...draft] as Extent
  if (props.bbox?.every((value, i) => value === extent[i])) return
  emit('update', extent)
}
</script>

<template>
  <AttributeFilterSection
    v-model:open="open"
    label="Zone géographique"
    :active-count="bbox ? 1 : 0"
  >
    <div class="grid grid-cols-3 gap-1">
      <UFormField
        v-for="side in SIDES"
        :key="side.index"
        :label="side.label"
        size="xs"
        :class="side.class"
        :error="invalidSides.has(side.index)"
      >
        <UInputNumber
          v-model="draft[side.index]"
          size="xs"
          :step="10 ** -COORDINATE_DECIMALS"
          :format-options="{ maximumFractionDigits: COORDINATE_DECIMALS }"
          :increment="false"
          :decrement="false"
          @blur="apply"
          @keydown.stop
        />
      </UFormField>
    </div>

    <p v-if="invalid" role="alert" class="text-error text-xs">
      Coordonnées invalides : l’ouest doit être inférieur à l’est et le sud au nord (degrés WGS 84).
    </p>

    <div class="flex flex-wrap gap-2">
      <UButton
        size="xs"
        :variant="drawing ? 'solid' : 'soft'"
        color="primary"
        icon="i-heroicons-pencil-square"
        @click="toggleDrawing"
      >
        {{ drawing ? 'Tracez un rectangle sur la carte' : 'Dessiner sur la carte' }}
      </UButton>
      <UButton
        v-if="bbox"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-x-mark"
        @click="emit('update', null)"
      >
        Effacer
      </UButton>
    </div>
  </AttributeFilterSection>
</template>
