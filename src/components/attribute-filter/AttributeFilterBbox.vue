<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Extent } from '@geospatial-sdk/core'
import { useBboxDraw } from '@/composables/useBboxDraw'
import AttributeFilterSection from './AttributeFilterSection.vue'

const props = defineProps<{ bbox: Extent | undefined }>()

const emit = defineEmits<{ update: [bbox: Extent | null] }>()

const { drawing, toggleDrawing } = useBboxDraw(
  () => props.bbox,
  (extent) => emit('update', extent),
)

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
const invalid = computed(() => {
  if (!complete.value) return false
  const [w, s, e, n] = draft as number[]
  return w! >= e! || s! >= n! || w! < -180 || e! > 180 || s! < -90 || n! > 90
})

function apply() {
  if (!complete.value || invalid.value) return
  const extent = [...draft] as Extent
  if (props.bbox?.every((value, i) => value === extent[i])) return
  emit('update', extent)
}
</script>

<template>
  <AttributeFilterSection label="Zone géographique" :active-count="bbox ? 1 : 0">
    <div class="grid grid-cols-3 gap-1">
      <UFormField
        v-for="side in SIDES"
        :key="side.index"
        :label="side.label"
        size="xs"
        :class="side.class"
      >
        <UInputNumber
          v-model="draft[side.index]"
          size="xs"
          :step="0.0001"
          :format-options="{ maximumFractionDigits: 4 }"
          :increment="false"
          :decrement="false"
          @blur="apply"
          @keydown.stop
        />
      </UFormField>
    </div>

    <p v-if="invalid" class="text-error text-xs">
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
