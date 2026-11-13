<script setup lang="ts">
import { useAttributeFilter } from '@/composables/useAttributeFilter'
import type { MapLayer } from '@/utils/layer.utils'
import AttributeFilterColumn from './AttributeFilterColumn.vue'

const props = defineProps<{ layer: MapLayer }>()

const {
  fields,
  fieldValues,
  count,
  totalCount,
  loading,
  error,
  searching,
  activeFilters,
  hasActiveFilters,
  toggleValue,
  resetFilters,
  searchValues,
  zooming,
  zoomToSelection,
} = useAttributeFilter(() => props.layer)
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="error"
    />

    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="n in 3" :key="n" class="h-8 w-full" />
    </div>

    <template v-else>
      <p v-if="count !== null && totalCount !== null" class="text-center text-sm font-medium">
        {{ count.toLocaleString('fr-FR') }} / {{ totalCount.toLocaleString('fr-FR') }} entité{{
          totalCount > 1 ? 's' : ''
        }}
      </p>

      <AttributeFilterColumn
        v-for="field in fields"
        :key="field.esField"
        :field="field"
        :values="fieldValues[field.esField]?.values ?? []"
        :truncated="fieldValues[field.esField]?.truncated ?? false"
        :selected="activeFilters[field.esField] ?? []"
        :searching="searching[field.esField] ?? false"
        @toggle="(value) => toggleValue(field.esField, value)"
        @search="(term) => searchValues(field.esField, term)"
      />

      <p v-if="!fields.length" class="text-muted text-sm">Aucune colonne filtrable.</p>

      <div class="flex flex-wrap justify-center gap-2">
        <UButton
          size="sm"
          variant="soft"
          color="primary"
          icon="i-heroicons-arrows-pointing-out"
          :loading="zooming"
          :disabled="count === 0"
          @click="zoomToSelection"
        >
          Zoomer sur la sélection
        </UButton>
        <UButton
          v-if="hasActiveFilters"
          size="sm"
          variant="soft"
          color="error"
          icon="i-heroicons-x-mark"
          @click="resetFilters"
        >
          Réinitialiser les filtres
        </UButton>
      </div>
    </template>
  </div>
</template>
