<template>
  <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
    <template v-if="loading">
      <USkeleton class="h-4 w-4" />
      <USkeleton class="h-4 w-32" />
    </template>
    <template v-else-if="error">
      <UAlert
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="error"
      />
    </template>
    <template v-else-if="itemCount === 0">
      <UIcon name="i-heroicons-information-circle" />
      <span>Aucun élément trouvé</span>
    </template>
    <template v-else>
      <UIcon name="i-heroicons-map" />
      <span>{{ itemCount }} {{ itemCount === 1 ? 'élément' : 'éléments' }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  error: string | null
  itemCount: number
}>()
</script>
