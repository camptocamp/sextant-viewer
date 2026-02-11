<template>
  <div class="flex gap-2">
    <UFieldGroup label="Date de début">
      <UInput type="date" :model-value="startDateString" @update:model-value="updateStartDate" />
    </UFieldGroup>

    <UFieldGroup label="Date de fin">
      <UInput type="date" :model-value="endDateString" @update:model-value="updateEndDate" />
    </UFieldGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { DateRangeFilter } from '@/types/stac.types'

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

function formatDateToInput(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const debouncedEmit = useDebounceFn((filter: DateRangeFilter) => {
  emit('update:filter', filter)
}, 400)

function updateStartDate(value: string) {
  if (isValidDateString(value)) {
    debouncedEmit({
      ...props.filter,
      start: value ? new Date(value) : null,
    })
  }
}

function updateEndDate(value: string) {
  if (isValidDateString(value)) {
    debouncedEmit({
      ...props.filter,
      end: value ? new Date(value) : null,
    })
  }
}

function isValidDateString(value: string): boolean {
  return (
    !!value &&
    !value.startsWith('0') &&
    !(value.split('-')[1] === '00') &&
    !(value.split('-')[2] === '00')
  )
}
</script>
