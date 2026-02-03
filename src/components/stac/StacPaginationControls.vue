<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex gap-1">
      <UButton
        icon="i-heroicons-chevron-left"
        size="xs"
        variant="soft"
        :disabled="!hasPreviousPage || loading"
        @click="goToPreviousPage"
      >
        Précédent
      </UButton>
      <UButton
        icon="i-heroicons-chevron-right"
        size="xs"
        variant="soft"
        trailing
        :disabled="!hasNextPage || loading"
        @click="goToNextPage"
      >
        Suivant
      </UButton>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      {{ countText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StacPagination } from '@/types/stac.types'

const props = defineProps<{
  pagination: StacPagination
  loading: boolean
}>()

const emit = defineEmits<{
  'next-page': []
  'prev-page': []
}>()

const hasNextPage = computed(() => props.pagination.nextLink !== null)
const hasPreviousPage = computed(() => props.pagination.previousLink !== null)

const countText = computed(() => {
  const { currentPage } = props.pagination
  return `Page ${currentPage}`
})

function goToNextPage() {
  emit('next-page')
}

function goToPreviousPage() {
  emit('prev-page')
}
</script>
