<script setup lang="ts">
import { computed } from 'vue'
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, isStacLayer, isWmsLayer, isWmtsLayer } from '@/utils/layer.utils'
import type { MapLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import StacLayerDetails from '@/components/stac/StacLayerDetails.vue'
import LayerLegend from '@/components/layer-manager/LayerLegend.vue'

const props = defineProps<{
  layer: MapLayer
}>()

const { opacity, canZoomToExtent, zoomToExtent, deleteLayer } = useLayerActions(() => props.layer)

const tabItems = computed(() => {
  const items = []
  if (isWmsLayer(props.layer) || isWmtsLayer(props.layer)) {
    items.push({ slot: 'legend', label: 'Légende' })
  }
  if (isStacLayer(props.layer)) {
    items.push({ slot: 'stac', label: 'Données' })
  }
  items.push({ slot: 'settings', label: 'Paramètres' })
  return items
})
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>

    <div class="mb-3 flex gap-2">
      <UButton
        icon="i-heroicons-arrows-pointing-out"
        color="primary"
        variant="soft"
        size="sm"
        :disabled="!canZoomToExtent"
        @click="zoomToExtent"
      >
        Zoomer sur l'étendue
      </UButton>
      <UButton icon="i-heroicons-trash" color="error" variant="soft" size="sm" @click="deleteLayer">
        Supprimer
      </UButton>
    </div>

    <UTabs :items="tabItems" :ui="{ content: 'p-3 h-full' }">
      <template #legend>
        <LayerLegend :layer="layer" />
      </template>

      <template #stac>
        <StacLayerDetails :layer="layer as MapLayerStac" />
      </template>

      <template #settings>
        <div class="flex items-baseline gap-2">
          <span class="shrink-0">Transparence :</span
          ><USlider v-model="opacity" :min="0" :max="100" tooltip class="w-full" />
        </div>
      </template>
    </UTabs>
  </div>
</template>
