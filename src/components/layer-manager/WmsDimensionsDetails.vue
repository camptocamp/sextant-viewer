<script setup lang="ts">
import { computed } from 'vue'
import { getWmsOtherDimensions } from '@/utils/wms.utils'
import type { MapLayer } from '@/utils/layer.utils'
import WmsDimensionField from '@/components/layer-manager/WmsDimensionField.vue'

const props = defineProps<{ layer: MapLayer }>()

const dimensions = computed(() =>
  // hide single-value dimensions (e.g. reference_time with one option) — nothing to choose
  getWmsOtherDimensions(props.layer).filter(
    (dim) => dim.values.flatMap((v) => v.split(',')).length > 1,
  ),
)
</script>

<template>
  <WmsDimensionField
    v-for="dim in dimensions"
    :key="dim.name"
    :layer="layer"
    :dimension-name="dim.name"
    :units="dim.unitSymbol || dim.units"
  />
</template>
