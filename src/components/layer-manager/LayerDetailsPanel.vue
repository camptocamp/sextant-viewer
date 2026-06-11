<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, getLegendUrl, hasLegendSupport, isStacLayer } from '@/utils/layer.utils'
import type { MapLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import StacLayerDetails from '@/components/stac/StacLayerDetails.vue'
import LayerLegend from '@/components/layer-manager/LayerLegend.vue'
import LayerSettings from '@/components/layer-manager/LayerSettings.vue'

const props = defineProps<{
  layer: MapLayer
}>()

const { canZoomToExtent, zoomToExtent, deleteLayer } = useLayerActions(() => props.layer)

const tabItems = computed(() => {
  const items = []
  if (hasLegendSupport(props.layer)) {
    items.push({
      slot: 'legend',
      value: 'legend',
      label: 'Légende',
      disabled: !getLegendUrl(props.layer),
    })
  }
  if (isStacLayer(props.layer)) {
    items.push({ slot: 'stac', value: 'stac', label: 'Données' })
  }
  items.push({ slot: 'settings', value: 'settings', label: 'Paramètres' })
  return items
})

// Set the default tab to the first available one
const defaultTab = computed(() => tabItems.value.find((item) => !item.disabled)?.value)

const activeTab = ref<string | undefined>(undefined)
watch(
  () => props.layer,
  () => {
    // Reset to default tab when layer changes
    activeTab.value = defaultTab.value
  },
  {
    immediate: true,
  },
)
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

    <UTabs v-model="activeTab" :items="tabItems" :ui="{ content: 'p-3 h-full' }">
      <template #legend>
        <LayerLegend :layer="layer" />
      </template>

      <template #stac>
        <StacLayerDetails :layer="layer as MapLayerStac" />
      </template>

      <template #settings>
        <LayerSettings :layer="layer" />
      </template>
    </UTabs>
  </div>
</template>
