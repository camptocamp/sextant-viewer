<script setup lang="ts">
import LayoutGrid from '@/components/layout/LayoutGrid.vue'
import { type ExtendedMapContext, useMapStore } from '@/stores/map.store.ts'
import { usePersistentContextStore } from '@/stores/persistentContext.store.ts'
import type { MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import { listen } from '@geospatial-sdk/openlayers'
import { onMounted, ref } from 'vue'
import type MapViewer from './map/MapViewer.vue'
import type { Extent } from 'ol/extent'
import type Map from 'ol/Map'
import { useAddLayer } from '@/composables/useAddLayer.ts'

const emit = defineEmits<{
  'map-extent-change': [extent: Extent]
}>()

const mapStore = useMapStore()
usePersistentContextStore()

const containerRef = ref<HTMLElement | null>(null)
const mapViewerRef = ref<typeof MapViewer | null>(null)

// This will copy the nuxt-ui-colors style tag into the shadow DOM of the custom element
onMounted(() => {
  const shadowDom = containerRef.value?.parentNode as ShadowRoot
  const shadowDomStyle = document.createElement('style')
  const nuxtUiColors = document.querySelector('[data-nuxt-ui-colors]') as HTMLStyleElement
  shadowDomStyle.innerText = nuxtUiColors.innerText
  shadowDom.insertBefore(shadowDomStyle, containerRef.value)
})

const onMapReady = (map: Map) => {
  listen(map, 'map-extent-change', (event) => {
    emit('map-extent-change', event.extent)
  })
}

const { addLayer } = useAddLayer()

const setInitialContext = (context: ExtendedMapContext) => {
  mapStore.setInitialContext(context, true)
}

// does not support layers that need enrichement
const setContext = (context: ExtendedMapContext) => {
  mapStore.setContext(context)
}

const cleanLayers = (layers: MapLayer[]) =>
  layers.map(({ id: _id, version: _version, ...rest }) => rest)

const getContext = (): ExtendedMapContext => {
  return {
    layers: cleanLayers(mapStore.layers),
    backgroundLayers: cleanLayers(mapStore.backgroundLayers),
    view: {
      extent: mapStore.currentExtent!,
    },
  }
}

const setView = (view: MapContextView) => {
  mapStore.setView(view)
}

defineExpose({
  addLayer,
  getContext,
  setContext,
  setInitialContext,
  setView,
})
</script>

<template>
  <div class="relative isolate" ref="containerRef">
    <UApp :portal="false">
      <MapViewer ref="mapViewerRef" @map-ready="onMapReady" />
      <LayoutGrid />
    </UApp>
  </div>
</template>
