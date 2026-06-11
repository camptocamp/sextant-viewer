<script setup lang="ts">
import { computed } from 'vue'
import type { MapLayer } from '@/utils/layer.utils'
import { getLegendUrl } from '@/utils/layer.utils'

const props = defineProps<{
  layer: MapLayer
}>()

const legendUrl = computed(() => getLegendUrl(props.layer))
</script>

<template>
  <img v-if="legendUrl" :src="legendUrl" alt="Légende" class="max-w-full" />
  <UAlert
    v-else
    color="neutral"
    variant="subtle"
    icon="i-heroicons-information-circle"
    title="Aucune légende disponible"
  />
</template>
