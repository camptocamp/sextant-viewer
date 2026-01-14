<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex gap-1">
      <UButton
        icon="i-heroicons-chevron-left"
        size="xs"
        variant="soft"
        :disabled="!hasPrevPage || loading"
        @click="goToPrevPage"
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
import type { StacPagination } from '@/types/stac-layer.types'

const props = defineProps<{
  pagination: StacPagination
  loading: boolean
}>()

const emit = defineEmits<{
  'next-page': []
  'prev-page': []
}>()

const hasNextPage = computed(() => props.pagination.nextLink !== null)
const hasPrevPage = computed(() => props.pagination.prevLink !== null)

const countText = computed(() => {
  const { currentPage, totalItems, itemsPerPage } = props.pagination
  
  if (totalItems !== null) {
    const start = (currentPage - 1) * itemsPerPage + 1
    const end = Math.min(currentPage * itemsPerPage, totalItems)
    return `${start}-${end} sur ${totalItems}`
  }
  
  return `Page ${currentPage}`
})

function goToNextPage() {
  emit('next-page')
}

function goToPrevPage() {
  emit('prev-page')
}
</script>
