<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DateRangeSelection } from '@/composables/useAttributeFilter'
import type { DateBounds, DateRangeIndexField } from '@/utils/geonetwork-index'
import AttributeFilterSection from './AttributeFilterSection.vue'

const props = defineProps<{
  field: DateRangeIndexField
  bounds: DateBounds | null | undefined
  selected: DateRangeSelection | undefined
}>()

const emit = defineEmits<{ update: [range: DateRangeSelection | null] }>()

// Drafts: the period only applies once both days are set, like in the previous Sextant viewer.
const from = ref('')
const to = ref('')
watch(
  () => props.selected,
  (selected) => {
    from.value = selected?.from ?? ''
    to.value = selected?.to ?? ''
  },
  { immediate: true },
)

const inverted = computed(() => !!from.value && !!to.value && from.value > to.value)

function apply() {
  if (!from.value || !to.value || inverted.value) return
  if (from.value === props.selected?.from && to.value === props.selected?.to) return
  emit('update', { from: from.value, to: to.value })
}

function selectWholePeriod() {
  if (!props.bounds) return
  from.value = props.bounds.min
  to.value = props.bounds.max
  apply()
}

function clear() {
  from.value = ''
  to.value = ''
  if (props.selected) emit('update', null)
}
</script>

<template>
  <AttributeFilterSection :label="field.label" :active-count="selected ? 1 : 0">
    <div class="grid grid-cols-2 gap-2">
      <UFormField label="Du" size="xs">
        <UInput
          v-model="from"
          type="date"
          size="xs"
          :min="bounds?.min"
          :max="to || bounds?.max"
          @change="apply"
          @keydown.stop
        />
      </UFormField>
      <UFormField label="Au" size="xs">
        <UInput
          v-model="to"
          type="date"
          size="xs"
          :min="from || bounds?.min"
          :max="bounds?.max"
          @change="apply"
          @keydown.stop
        />
      </UFormField>
    </div>

    <p v-if="inverted" class="text-error text-xs">
      La date de début est postérieure à la date de fin.
    </p>
    <p v-else-if="bounds" class="text-dimmed text-xs">
      Données du {{ new Date(bounds.min).toLocaleDateString('fr-FR') }} au
      {{ new Date(bounds.max).toLocaleDateString('fr-FR') }}.
    </p>

    <div class="flex gap-2">
      <UButton
        size="xs"
        variant="soft"
        color="neutral"
        :disabled="!bounds"
        @click="selectWholePeriod"
      >
        Toute la période
      </UButton>
      <UButton
        v-if="selected || from || to"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-x-mark"
        @click="clear"
      >
        Effacer
      </UButton>
    </div>
  </AttributeFilterSection>
</template>
