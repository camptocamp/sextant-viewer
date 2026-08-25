<script setup lang="ts">
import { computed } from 'vue'
import type { WpsExecuteResponse } from '@camptocamp/ogc-client'
import type { WpsOutputResult } from '@/types/wps.types'

const props = defineProps<{
  result: WpsExecuteResponse | null
  error?: string | null
  outputs?: WpsOutputResult[]
}>()

const pending = computed(
  () => props.result && ['accepted', 'started', 'paused'].includes(props.result.status),
)

function downloadHref(output: Extract<WpsOutputResult, { kind: 'geojson' | 'download' }>) {
  const href = output.kind === 'geojson' ? output.url : output.href
  if (href) return href
  if (output.data) {
    const mimeType = output.mimeType || 'text/plain'
    return `data:${mimeType};charset=utf-8,${encodeURIComponent(output.data)}`
  }
  return null
}
</script>

<template>
  <div v-if="error || result" class="space-y-4">
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
        <div v-if="outputs?.length" class="space-y-2">
          <h4 class="text-sm font-semibold">Résultats</h4>
          <UFormField v-for="output in outputs" :key="output.identifier" :label="output.label">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-if="output.mapStatus === 'added'"
                color="success"
                variant="subtle"
                size="sm"
              >
                Couche ajoutée à la carte
              </UBadge>
              <UTooltip v-else-if="output.mapStatus === 'failed'" :text="output.mapError">
                <UBadge color="warning" variant="subtle" size="sm">
                  L'ajout à la carte a échoué
                </UBadge>
              </UTooltip>
              <UBadge
                v-else-if="output.mapStatus === 'pending'"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
                Ajout à la carte…
              </UBadge>
              <UButton
                v-if="output.kind !== 'wms' && downloadHref(output)"
                :to="downloadHref(output)!"
                download
                target="_blank"
                rel="noopener"
                size="xs"
                variant="soft"
                icon="i-heroicons-arrow-down-tray"
                label="Télécharger"
              />
            </div>
          </UFormField>
        </div>
      </template>
    </template>
  </div>
</template>
