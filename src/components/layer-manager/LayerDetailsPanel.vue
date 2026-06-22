<script setup lang="ts">
import { useLayerActions } from '@/composables/useLayerActions'
import { getLayerLabel, isStacLayer } from '@/utils/layer.utils'
import type { MapLayer } from '@/utils/layer.utils'
import type { MapLayerStac } from '@/types/stac.types'
import StacLayerDetails from '@/components/stac/StacLayerDetails.vue'
import LayerSettings from '@/components/layer-manager/LayerSettings.vue'

const props = defineProps<{
  layer: MapLayer
}>()

const { canZoomToExtent, zoomToExtent, deleteLayer } = useLayerActions(() => props.layer)
</script>

<template>
  <div class="p-2">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-md line-clamp-2 font-semibold text-clip">
        {{ getLayerLabel(layer) }}
      </h3>
    </div>
    <StacLayerDetails v-if="isStacLayer(layer)" :layer="layer as MapLayerStac" />

    <LayerSettings :layer="layer" />

    <div class="flex gap-2">
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
  </div>
</template>
