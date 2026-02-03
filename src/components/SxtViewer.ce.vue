<script setup lang="ts">
import LayoutGrid from '@/components/layout/LayoutGrid.vue'
import { useMapStore, type ExtendedMapContext } from '@/stores/map.store'
import type { MapContextLayer, MapContextView } from '@geospatial-sdk/core'
import { listen } from '@geospatial-sdk/openlayers'
import { onMounted, ref } from 'vue'
import type MapViewer from './map/MapViewer.vue'
import type { Extent } from 'ol/extent'
import type Map from 'ol/Map'

const emit = defineEmits<{
  'map-extent-change': [extent: Extent]
}>()

const mapStore = useMapStore()

const containerRef = ref<HTMLElement | null>(null)

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

const addLayer = (layer: MapContextLayer) => {
  mapStore.addLayer(layer)
}

const setContext = (context: ExtendedMapContext) => {
  mapStore.setContext(context)
}

const setView = (view: MapContextView) => {
  mapStore.setView(view)
}

defineExpose({
  addLayer,
  setContext,
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
