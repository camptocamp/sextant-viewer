<script setup lang="ts">
import { useAttributeFilter } from '@/composables/useAttributeFilter'
import type { MapLayer } from '@/utils/layer.utils'
import AttributeFilterBbox from './AttributeFilterBbox.vue'
import AttributeFilterColumn from './AttributeFilterColumn.vue'
import AttributeFilterDateRange from './AttributeFilterDateRange.vue'
import AttributeFilterTree from './AttributeFilterTree.vue'

const props = defineProps<{ layer: MapLayer }>()

const {
  fields,
  geometryName,
  fieldValues,
  dateBounds,
  count,
  totalCount,
  loading,
  error,
  searching,
  expandedPaths,
  activeFilters,
  hasActiveFilters,
  toggleValue,
  toggleTreePath,
  setDateRange,
  setBbox,
  resetFilters,
  searchValues,
  setExpanded,
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

      <template v-for="field in fields" :key="field.esField">
        <AttributeFilterTree
          v-if="field.type === 'tree'"
          :field="field"
          :values="fieldValues[field.esField]?.values ?? []"
          :truncated="fieldValues[field.esField]?.truncated ?? false"
          :selected="activeFilters.values[field.esField] ?? []"
          :expanded="expandedPaths[field.esField] ?? []"
          :searching="searching[field.esField] ?? false"
          @toggle="(path) => toggleTreePath(field.esField, path)"
          @search="(term) => searchValues(field.esField, term)"
          @update:expanded="(paths) => setExpanded(field.esField, paths)"
        />
        <AttributeFilterDateRange
          v-else-if="field.type === 'dateRange'"
          :field="field"
          :bounds="dateBounds[field.esField]"
          :selected="activeFilters.dateRanges[field.esField]"
          @update="(range) => setDateRange(field.esField, range)"
        />
        <AttributeFilterColumn
          v-else
          :field="field"
          :values="fieldValues[field.esField]?.values ?? []"
          :truncated="fieldValues[field.esField]?.truncated ?? false"
          :selected="activeFilters.values[field.esField] ?? []"
          :searching="searching[field.esField] ?? false"
          @toggle="(value) => toggleValue(field.esField, value)"
          @search="(term) => searchValues(field.esField, term)"
        />
      </template>

      <AttributeFilterBbox v-if="geometryName" :bbox="activeFilters.bbox" @update="setBbox" />

      <p v-if="!fields.length && !geometryName" class="text-muted text-sm">
        Aucune colonne filtrable.
      </p>

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
