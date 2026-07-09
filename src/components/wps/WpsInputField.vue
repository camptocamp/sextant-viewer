<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map.store'
import type { WpsProcessInput, WpsInputOccurrence } from '@/types/wps.types'

const props = defineProps<{
  input: WpsProcessInput
}>()

const model = defineModel<WpsInputOccurrence>({ required: true })

const mapStore = useMapStore()

const isNumber = computed(() =>
  /float|double|int|long|decimal|number/i.test(props.input.literalData?.dataType ?? ''),
)

const allowedValues = computed(() => props.input.literalData?.allowedValues ?? [])

const literalValue = computed({
  get: () => model.value.literalValue ?? '',
  set: (value: string) => (model.value = { ...model.value, literalValue: value }),
})

const complexContent = computed({
  get: () => model.value.complexContent ?? '',
  set: (value: string) => (model.value = { ...model.value, complexContent: value }),
})

const bboxValue = computed({
  get: () => model.value.bboxValue ?? '',
  set: (value: string) => (model.value = { ...model.value, bboxValue: value }),
})

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
        v-if="allowedValues.length"
        v-model="literalValue"
        :items="allowedValues"
        class="w-full"
      />
      <UInput v-else v-model="literalValue" :type="isNumber ? 'number' : 'text'" class="w-full" />
    </template>

    <UFieldGroup v-else-if="input.type === 'boundingbox'" class="w-full">
      <UInput v-model="bboxValue" placeholder="minX,minY,maxX,maxY" class="flex-1" />
      <UButton
        icon="i-heroicons-map"
        color="neutral"
        variant="subtle"
        title="Utiliser l'emprise de la carte"
        @click="useMapExtent()"
      />
    </UFieldGroup>

    <UTextarea
      v-else-if="input.type === 'complex'"
      v-model="complexContent"
      :rows="4"
      placeholder="Coller du GeoJSON, WKT ou GML…"
      class="w-full"
    />
  </div>
</template>
