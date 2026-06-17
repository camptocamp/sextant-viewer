<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { useWmsTimeDimension } from '@/composables/useWmsTimeDimension'
import type { MapLayer } from '@/utils/layer.utils'

const props = defineProps<{ layer: MapLayer }>()

const {
  currentDate,
  reset,
  setNow,
  allowedDates,
  minDate,
  maxDate,
  supportsCurrent,
  nearestValue,
} = useWmsTimeDimension(() => props.layer)

const formatDate = (date: Date | null): string => {
  if (!date) return '—'
  // WMS time values are expressed in UTC; display them in UTC to stay consistent
  // with the calendar picker (which is timezone-naive) and the server values.
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

// Calendar cells are timezone-naive (y/m/d). Map to/from the UTC calendar day so
// selections line up with the WMS dimension values, which are expressed in UTC.
function toCalendarDate(date: Date | null): DateValue | undefined {
  if (!date) return undefined
  return new CalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

// Key a Date by its UTC calendar day so picker selections map back to the exact
// allowed value (which carries the precise time component the WMS server expects).
function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
}

const allowedDateByDay = computed<Map<string, Date>>(() => {
  return new Map(allowedDates.value.map((d) => [utcDayKey(d), d]))
})

const calendarValue = computed<DateValue | undefined>({
  get: () => toCalendarDate(currentDate.value),
  set: (value) => {
    if (!value) {
      currentDate.value = null
      return
    }
    const key = `${value.year}-${value.month - 1}-${value.day}`
    // Snap to the exact allowed value for that day if the layer enumerates values,
    // otherwise use the picked day at UTC midnight.
    currentDate.value =
      allowedDateByDay.value.get(key) ?? new Date(Date.UTC(value.year, value.month - 1, value.day))
  },
})

// nearestValue=false means the server requires exact values → disable all non-matching dates
function isDateDisabled(date: DateValue): boolean {
  if (nearestValue.value || allowedDates.value.length === 0) return false
  return !allowedDateByDay.value.has(`${date.year}-${date.month - 1}-${date.day}`)
}

// Open the calendar at the min date (or default) rather than today
const calendarPlaceholder = computed<DateValue | undefined>(() => toCalendarDate(minDate.value))
</script>

<template>
  <div class="mb-3">
    <p class="mb-1 text-xs text-gray-400">
      Minimum&nbsp;: {{ formatDate(minDate) }}, maximum&nbsp;: {{ formatDate(maxDate) }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <span class="shrink-0 text-sm">Paramètre TIME&nbsp;:</span>
      <UPopover :content="{ side: 'top', align: 'start' }">
        <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-calendar">
          {{ currentDate ? formatDate(currentDate) : 'Non définie' }}
        </UButton>
        <template #content>
          <UCalendar
            v-model="calendarValue"
            :placeholder="calendarValue ?? calendarPlaceholder"
            :is-date-disabled="isDateDisabled"
            class="p-2"
          />
        </template>
      </UPopover>
      <UButton size="sm" color="neutral" variant="soft" @click="reset">Réinitialiser</UButton>
      <UButton v-if="supportsCurrent" size="sm" color="neutral" variant="soft" @click="setNow">
        Maintenant
      </UButton>
    </div>
  </div>
</template>
