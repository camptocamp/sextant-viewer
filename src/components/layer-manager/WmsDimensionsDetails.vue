<script setup lang="ts">
import { computed } from 'vue'
import { useWmsOtherDimensions } from '@/composables/useWmsDimension'
import type { MapLayer } from '@/utils/layer.utils'
import WmsDimensionField from '@/components/layer-manager/WmsDimensionField.vue'

const props = defineProps<{ layer: MapLayer }>()

const { dimensions: rawDimensions } = useWmsOtherDimensions(() => props.layer)

// Wrap in computed to ensure proper reactivity tracking
const dimensions = computed(() => rawDimensions.value)
</script>

<template>
  <div>
    <WmsDimensionField
      v-for="dim in dimensions"
      :key="dim.name"
      :layer="layer"
      :dimension-name="dim.name"
      :units="dim.unitSymbol || dim.units"
    />
  </div>
</template>
