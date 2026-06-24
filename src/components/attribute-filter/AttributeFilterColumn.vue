<script setup lang="ts">
import { computed, ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { AttributeFieldConfig, FieldValue } from '@/types/attribute-filter.types'

const props = defineProps<{
  field: AttributeFieldConfig
  values: readonly FieldValue[]
  truncated: boolean
  selected: readonly string[]
}>()

const emit = defineEmits<{ toggle: [value: string] }>()

const search = ref('')
// Debounce the term the list filters on so typing stays responsive; the input stays bound to `search`.
const debouncedSearch = refDebounced(search, 200)

const filteredValues = computed(() => {
  const term = debouncedSearch.value.trim().toLowerCase()
  if (!term) return props.values
  return props.values.filter((item) => item.value.toLowerCase().includes(term))
})

// The cap only applies to the full list; a search shows every client-side match, so it isn't truncated.
const showTruncated = computed(() => props.truncated && !debouncedSearch.value.trim())
</script>

<template>
  <UCollapsible class="border-default rounded border">
    <template #default="{ open }">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm font-medium"
      >
        <span class="truncate">{{ field.label }}</span>
        <span class="flex shrink-0 items-center gap-1">
          <UBadge v-if="selected.length" size="xs" color="primary" variant="soft">
            {{ selected.length }}
          </UBadge>
          <UIcon
            name="i-heroicons-chevron-down"
            class="transition-transform"
            :class="{ 'rotate-180': open }"
          />
        </span>
      </button>
    </template>

    <template #content>
      <div class="space-y-2 px-2 pb-2">
        <UInput
          v-if="values.length > 8"
          v-model="search"
          size="xs"
          icon="i-heroicons-magnifying-glass"
          placeholder="Rechercher une valeur"
          @keydown.stop
        />

        <div class="max-h-56 space-y-1 overflow-y-auto">
          <label
            v-for="item in filteredValues"
            :key="item.value"
            class="flex cursor-pointer items-center gap-2 text-sm"
          >
            <UCheckbox
              :model-value="selected.includes(item.value)"
              @update:model-value="emit('toggle', item.value)"
            />
            <span class="grow truncate" :title="item.value">{{ item.value }}</span>
            <span class="text-muted shrink-0 text-xs">{{ item.count }}</span>
          </label>

          <p v-if="filteredValues.length === 0" class="text-muted text-xs">Aucune valeur</p>
        </div>

        <p v-if="showTruncated" class="text-dimmed text-xs">
          Liste limitée à {{ values.length }} valeurs — affinez avec la recherche.
        </p>
      </div>
    </template>
  </UCollapsible>
</template>
