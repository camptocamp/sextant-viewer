<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { FieldValue, IndexField } from '@/utils/geonetwork-index'

const props = defineProps<{
  field: IndexField
  values: readonly FieldValue[]
  truncated: boolean
  selected: readonly string[]
  searching: boolean
}>()

const emit = defineEmits<{ toggle: [value: string]; search: [term: string] }>()

const search = ref('')
// Debounced so typing doesn't send one index query per keystroke.
const debouncedSearch = refDebounced(search, 300)

watch(
  () => debouncedSearch.value.trim(),
  (term) => emit('search', term),
)

// Latched: `values` holds search results, so deriving visibility from them would unmount the
// input mid-search (e.g. while a cleared term is refetching, or for good if that refetch fails).
const searchable = ref(false)
watchEffect(() => {
  if (props.truncated || props.values.length > 8) searchable.value = true
})
</script>

<template>
  <UCollapsible class="border-default rounded border">
    <template #default="{ open }">
      <UButton variant="ghost" color="neutral" block class="justify-between font-medium">
        <span class="truncate">{{ field.label }}</span>
        <template #trailing>
          <UBadge v-if="selected.length" size="xs" color="primary" variant="soft">
            {{ selected.length }}
          </UBadge>
          <UIcon
            name="i-heroicons-chevron-down"
            class="transition-transform"
            :class="{ 'rotate-180': open }"
          />
        </template>
      </UButton>
    </template>

    <template #content>
      <div class="space-y-2 px-2 pb-2">
        <UInput
          v-if="searchable"
          v-model="search"
          :loading="searching"
          size="xs"
          icon="i-heroicons-magnifying-glass"
          placeholder="Rechercher une valeur"
          @keydown.stop
        />

        <div class="max-h-56 space-y-1 overflow-y-auto">
          <UCheckbox
            v-for="item in values"
            :key="item.value"
            :model-value="selected.includes(item.value)"
            :ui="{
              root: 'cursor-pointer items-center gap-2',
              wrapper: 'min-w-0',
              label: 'flex items-center gap-2 font-normal',
            }"
            @update:model-value="emit('toggle', item.value)"
          >
            <template #label>
              <span class="grow truncate" :title="item.value">{{ item.value }}</span>
              <span class="text-muted shrink-0 text-xs">{{ item.count }}</span>
            </template>
          </UCheckbox>

          <p v-if="values.length === 0" class="text-muted text-xs">Aucune valeur</p>
        </div>

        <p v-if="truncated" class="text-dimmed text-xs">
          Liste limitée à {{ values.length }} valeurs — affinez la recherche.
        </p>
      </div>
    </template>
  </UCollapsible>
</template>
