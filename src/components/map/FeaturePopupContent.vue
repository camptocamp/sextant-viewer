<script setup lang="ts">
import type { FeatureAttribute } from '@/types/feature-selection.types'

defineProps<{
  layerName: string
  featureId: string
  attributes: FeatureAttribute[]
}>()

const emit = defineEmits<{
  close: []
}>()

function renderValueWithLinks(
  attr: FeatureAttribute,
): { type: 'text' | 'link'; content: string }[] {
  if (attr.urls.length === 0) {
    return [{ type: 'text', content: attr.displayValue }]
  }

  const parts: { type: 'text' | 'link'; content: string }[] = []
  let remaining = attr.displayValue

  for (const url of attr.urls) {
    const index = remaining.indexOf(url)
    if (index > 0) {
      parts.push({ type: 'text', content: remaining.slice(0, index) })
    }
    parts.push({ type: 'link', content: url })
    remaining = remaining.slice(index + url.length)
  }

  if (remaining.length > 0) {
    parts.push({ type: 'text', content: remaining })
  }

  return parts
}
</script>

<template>
  <div class="max-w-96 min-w-64">
    <div
      class="flex items-start justify-between gap-2 border-b border-gray-200 pb-2 dark:border-gray-700"
    >
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ layerName }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ featureId }}</p>
      </div>
      <UButton
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Fermer"
        @click="emit('close')"
      />
    </div>

    <div class="mt-2 max-h-64 space-y-1 overflow-y-auto">
      <div v-for="attr in attributes" :key="attr.name" class="flex flex-wrap gap-1 text-sm">
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ attr.name }}:</span>
        <span class="text-gray-600 dark:text-gray-400">
          <template v-for="(part, index) in renderValueWithLinks(attr)" :key="index">
            <a
              v-if="part.type === 'link'"
              :href="part.content"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >{{ part.content }}</a
            >
            <template v-else>{{ part.content }}</template>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>
