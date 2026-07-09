<script setup lang="ts">
import { computed } from 'vue'
import type { WpsExecuteResponse, WpsExecuteOutputResult } from '@camptocamp/ogc-client'

const props = defineProps<{
  result: WpsExecuteResponse | null
  error?: string | null
  addedLayers?: string[]
}>()

const pending = computed(
  () => props.result && ['accepted', 'started', 'paused'].includes(props.result.status),
)

function isOnMap(output: WpsExecuteOutputResult) {
  return (props.addedLayers ?? []).includes(output.title || output.identifier)
}

function downloadHref(output: WpsExecuteOutputResult) {
  if (output.reference?.href) return output.reference.href
  if (output.data?.content) {
    const mimeType = output.data.mimeType || 'text/plain'
    return `data:${mimeType};charset=utf-8,${encodeURIComponent(output.data.content)}`
  }
  return null
}
</script>

<template>
  <div v-if="error || result" class="space-y-2">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      title="Échec de l'exécution"
      :description="error"
    />

    <template v-else-if="result">
      <UAlert
        v-if="pending"
        color="info"
        variant="soft"
        icon="i-heroicons-clock"
        :title="`Exécution en cours (${result.status})`"
        :description="result.percentCompleted != null ? `${result.percentCompleted} %` : undefined"
      >
        <template v-if="result.percentCompleted != null" #description>
          <UProgress :model-value="result.percentCompleted" class="mt-2" />
        </template>
      </UAlert>

      <template v-else-if="result.status === 'succeeded'">
        <UAlert
          color="success"
          variant="soft"
          icon="i-heroicons-check-circle"
          title="Exécution réussie"
        />
        <div
          v-for="output in result.outputs"
          :key="output.identifier"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span>{{ output.title || output.identifier }}</span>
          <UBadge v-if="isOnMap(output)" color="success" variant="subtle" size="sm">
            Couche ajoutée à la carte
          </UBadge>
          <UButton
            v-else-if="downloadHref(output)"
            :to="downloadHref(output)!"
            target="_blank"
            size="xs"
            variant="soft"
            icon="i-heroicons-arrow-down-tray"
            label="Télécharger"
          />
        </div>
      </template>
    </template>
  </div>
</template>
