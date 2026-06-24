<script setup lang="ts">
import LayoutGrid from '@/components/layout/LayoutGrid.vue'
import { type ExtendedMapContext, useMapStore } from '@/stores/map.store.ts'
import { usePersistentContextStore } from '@/stores/persistentContext.store.ts'
import type { MapContextView } from '@geospatial-sdk/core'
import type { MapLayer } from '@/utils/layer.utils'
import type { DataSource } from '@/types/attribute-filter.types'
import { listen } from '@geospatial-sdk/openlayers'
import { onMounted, ref } from 'vue'
import type MapViewer from './map/MapViewer.vue'
import type { Extent } from 'ol/extent'
import type Map from 'ol/Map'
import { useAddLayer } from '@/composables/useAddLayer.ts'

const emit = defineEmits<{
  /** Émis à chaque déplacement ou zoom de la carte. Le payload est en EPSG:4326. */
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

/**
 * Ajoute une couche au-dessus de la pile de couches actuelle.
 * @param layer - Définition de la couche. Accepte tous les types `MapContextLayer` ainsi que le type `stac`.
 * @param zoomToExtent - Si `true` et que la couche a une emprise connue, la vue s'ajuste automatiquement.
 */
const { addLayer } = useAddLayer()

/**
 * Définit le contexte initial et déclenche l'enrichissement des couches.
 * À utiliser au premier chargement ou pour les couches nécessitant une initialisation
 * asynchrone (ex. collections STAC).
 * @param context - Le contexte initial de la carte.
 */
const setInitialContext = (context: ExtendedMapContext): void => {
  mapStore.setInitialContext(context, true)
}

/**
 * Remplace l'intégralité du contexte de carte (couches, couches de fond, vue).
 * Ne supporte pas les couches nécessitant un enrichissement asynchrone (ex. STAC) ;
 * utiliser `setInitialContext` dans ce cas.
 * @param context - Le nouveau contexte à appliquer.
 */
const setContext = (context: ExtendedMapContext): void => {
  mapStore.setContext(context)
}

const cleanLayers = (layers: MapLayer[]) =>
  layers.map(({ id: _id, version: _version, ...rest }) => rest)

/**
 * Retourne le contexte de carte actuel incluant les couches, couches de fond et l'étendue de la vue.
 * Les métadonnées internes (`id`, `version`) sont supprimées du résultat.
 */
const getContext = (): ExtendedMapContext => {
  return {
    layers: cleanLayers(mapStore.layers),
    backgroundLayers: cleanLayers(mapStore.backgroundLayers),
    view: {
      extent: mapStore.currentExtent!,
    },
  }
}

/**
 * Déplace ou zoom la carte vers la vue spécifiée sans modifier les couches.
 * @param view - Vue définie par zoom+centre, emprise ou géométrie.
 */
const setView = (view: MapContextView): void => {
  mapStore.setView(view)
}

// Register a data source (e.g. an ElasticSearch index) probed to detect filterable WMS layers.
const addDataSource = (dataSource: DataSource) => {
  mapStore.addDataSource(dataSource)
}

defineExpose({
  addDataSource,
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
