<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { useWmsTimeDimension } from '@/composables/useWmsTimeDimension'
import type { MapLayer } from '@/utils/layer.utils'

// Days carrying a value are tinted green: the selected day already owns the theme's
// solid primary, so a second blue would read as a weaker selection rather than as
// availability. Guarded on data-selected so the two never fight over a cell.
const AVAILABLE_DAY_CLASS = [
  'not-data-disabled:not-data-selected:bg-success/20',
  'not-data-disabled:font-semibold',
].join(' ')

const props = defineProps<{ layer: MapLayer }>()

const {
  currentDate,
  reset,
  setNow,
  allowedDates,
  minDate,
  maxDate,
  supportsCurrent,
  isEnumerated,
  timesForDay,
  previousDate,
  nextDate,
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

// UTC midnight of a date's calendar day, for whole-day range comparisons.
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
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

function isDateDisabled(date: DateValue): boolean {
  // Enumerated list: only the listed days are selectable.
  if (isEnumerated.value) {
    return !allowedDateByDay.value.has(`${date.year}-${date.month - 1}-${date.day}`)
  }
  // Interval: bound on [min, max] — allowedDates is capped, so unusable here.
  const picked = Date.UTC(date.year, date.month - 1, date.day)
  if (minDate.value && picked < utcDay(minDate.value)) return true
  if (maxDate.value && picked > utcDay(maxDate.value)) return true
  return false
}

// Open the calendar at the min date (or default) rather than today
const calendarPlaceholder = computed<DateValue | undefined>(() => toCalendarDate(minDate.value))

// Discrete instants the server offers on the selected day. Only a real choice
// (>1) warrants a control — a single instant is already fixed by the day.
const timesForCurrentDay = computed<Map<string, Date>>(() =>
  currentDate.value ? timesForDay(currentDate.value) : new Map(),
)

const timeValue = computed<string>({
  get: () => {
    const d = currentDate.value
    if (!d) return ''
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  },
  set: (value) => {
    const exact = timesForCurrentDay.value.get(value)
    if (exact) currentDate.value = exact
  },
})
</script>

<template>
  <div class="mb-3">
    <p class="mb-1 text-xs text-gray-400">
      Minimum&nbsp;: {{ formatDate(minDate) }}, maximum&nbsp;: {{ formatDate(maxDate) }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <span class="shrink-0 text-sm">Temps&nbsp;:</span>
      <UButton
        icon="i-lucide-chevron-left"
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="!previousDate"
        aria-label="Valeur précédente"
        @click="currentDate = previousDate"
      />
      <UPopover :content="{ side: 'top', align: 'start' }">
        <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-calendar">
          {{ currentDate ? formatDate(currentDate) : 'Non définie' }}
        </UButton>
        <template #content>
          <div class="flex flex-col gap-2 p-2">
            <UCalendar
              v-model="calendarValue"
              :placeholder="calendarValue ?? calendarPlaceholder"
              :is-date-disabled="isDateDisabled"
              :ui="{ cellTrigger: AVAILABLE_DAY_CLASS }"
            />
            <label v-if="timesForCurrentDay.size > 1" class="flex items-center gap-2 text-sm">
              Heure&nbsp;:
              <USelect
                v-model="timeValue"
                :items="[...timesForCurrentDay.keys()]"
                size="sm"
                aria-label="Heure"
              />
            </label>
          </div>
        </template>
      </UPopover>
      <UButton
        icon="i-lucide-chevron-right"
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="!nextDate"
        aria-label="Valeur suivante"
        @click="currentDate = nextDate"
      />
      <UButton size="sm" color="neutral" variant="soft" @click="reset">Réinitialiser</UButton>
      <UButton v-if="supportsCurrent" size="sm" color="neutral" variant="soft" @click="setNow">
        Maintenant
      </UButton>
    </div>
  </div>
</template>
