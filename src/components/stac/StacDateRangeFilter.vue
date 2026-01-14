<template>
  <div class="flex gap-2">
    <UFieldGroup label="Date de début">
      <UInput
        type="date"
        :model-value="startDateString"
        @update:model-value="updateStartDate"
      />
    </UFieldGroup>
    
    <UFieldGroup label="Date de fin">
      <UInput
        type="date"
        :model-value="endDateString"
        @update:model-value="updateEndDate"
      />
    </UFieldGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DateRangeFilter } from '@/types/stac-layer.types'

const props = defineProps<{
  filter: DateRangeFilter
}>()

const emit = defineEmits<{
  'update:filter': [filter: DateRangeFilter]
}>()

const startDateString = computed(() => {
  return props.filter.start ? formatDateToInput(props.filter.start) : ''
})

const endDateString = computed(() => {
  return props.filter.end ? formatDateToInput(props.filter.end) : ''
})

function formatDateToInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function updateStartDate(value: string) {
  emit('update:filter', {
    ...props.filter,
    start: value ? new Date(value) : null,
  })
}

function updateEndDate(value: string) {
  emit('update:filter', {
    ...props.filter,
    end: value ? new Date(value) : null,
  })
}
</script>
