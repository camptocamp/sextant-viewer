---
name: ogc-client-integration
description: Helper for using @camptocamp/ogc-client to discover and load layers from OGC services (WMS, WMTS, WFS, OGC API Features, STAC) into MapContext. Use when working with OGC services, service capabilities, layer discovery, or dynamically loading map layers from remote sources. Triggers include mentions of WMS, WMTS, WFS, OGC API, STAC, GetCapabilities, service discovery, or loading layers from URLs.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# OGC Client Integration for Vue.js Map Applications

This Skill helps you integrate [@camptocamp/ogc-client](https://github.com/camptocamp/ogc-client) into Vue.js applications to discover and load layers from OGC-compliant geospatial services into your MapContext-based map viewer.

## What is ogc-client?

**ogc-client** is a TypeScript library that simplifies interaction with OGC (Open Geospatial Consortium) web services by:
- Abstracting away version differences between service implementations
- Converting XML responses to JavaScript objects
- Providing clean, consistent APIs for different service types
- Using web workers for heavy processing (non-blocking)
- Implementing persistent caching to reduce network requests
- Detecting CORS issues proactively

## Supported OGC Standards

- **WMS** (Web Map Service) - Raster map images
- **WMTS** (Web Map Tile Service) - Pre-rendered map tiles
- **WFS** (Web Feature Service) - Vector features
- **OGC API Features** - Modern RESTful feature access
- **TMS** (Tile Map Service) - Tile-based maps
- **STAC API** (SpatioTemporal Asset Catalog) - Asset discovery

## Installation

```bash
npm install @camptocamp/ogc-client
```

**Current Version**: Check [npm registry](https://www.npmjs.com/package/@camptocamp/ogc-client)

## Architecture Pattern: OGC Services + MapContext from geospatial-sdk

### Integration Flow

```
User enters service URL
        ↓
    ogc-client
        ↓
Query GetCapabilities
        ↓
Parse available layers
        ↓
User selects layer(s)
        ↓
Get Full layer definition
        ↓
Create MapContextLayer
        ↓
Add to Pinia MapContext
        ↓
geospatial-sdk renders
```

### Key Principle

- **ogc-client discovers layers → MapContext stores configuration → geospatial-sdk renders**

- OGC endpoints are ready to use after calling the `isReady()` method, which fetches and parses the service capabilities.

- **ogc-client** discovery just provides summaries of layers (`WmsLayerSummary`, `WmtsLayerSummary`, `WfsFeatureTypeBrief` etc.). When adding a layer to the MapContext, you must get the full version of the layer by using the `endpoint.getLayerByName()` method (or equivalent for other services) to retrieve all necessary metadata. Metadata that can't match the `LayerContext` model should be added to the `extras` property of the MapContext layer for future reference.

## Basic Usage Patterns

### Import Endpoint Classes

```typescript
import {
  WmsEndpoint,
  WfsEndpoint,
  WmtsEndpoint,
  OgcApiEndpoint
} from '@camptocamp/ogc-client'
```

### Disable Web Workers (Optional)

If you need to preserve the `Referer` header or have worker issues:

```typescript
import { enableFallbackWithoutWorker } from '@camptocamp/ogc-client'

// Call once at app initialization
enableFallbackWithoutWorker()
```

## WMS Integration

### 1. Query WMS Capabilities

```typescript
import { WmsEndpoint } from '@camptocamp/ogc-client'

async function discoverWmsLayers(serviceUrl: string) {
  try {
    // Create endpoint and fetch capabilities
    const endpoint = await new WmsEndpoint(serviceUrl).isReady()

    // Get service info
    const info = endpoint.getServiceInfo()
    console.log('Service Title:', info.title)
    console.log('Service Abstract:', info.abstract)

    // Get available layers
    const layers = endpoint.getLayers()
  } catch (error) {
    console.error('Failed to query WMS:', error)
    throw error
  }
}
```

### 2. Add WMS Layer to MapContext

```typescript
import { useMapStore } from '@/stores/map.store'
import type { MapContextLayerWms, createViewFromLayer } from '@geospatial-sdk/core'

async function addWmsLayerFromService(
  serviceUrl: string,
  layerName: string
) {
  const mapStore = useMapStore()

  // Query service for layer details
  const endpoint = await new WmsEndpoint(serviceUrl).isReady()
  const layer = endpoint.getLayerByName(layerName)

  if (!layer) {
    throw new Error(`Layer ${layerName} not found`)
  }

  // Create MapContext layer configuration
  const mapContextLayer: MapContextLayerWms = {
    type: 'wms',
    id: `layerName`,
    url: serviceUrl,
    name: layerName,
    visibility: true,
    opacity: 1,
    version: 0,
    label: layer.title || layerName,
  }
  
  mapContextLayer.extras = {
    extent: createViewFromLayer(mapContextLayer).extent,
  }

  // Add to MapContext
  mapStore.addLayer(mapContextLayer)
}
```

### 3. Generate Map Request URL

```typescript
// Get URL for map image request
const imageUrl = endpoint.getMapUrl({
  layers: ['layer1', 'layer2'],
  width: 800,
  height: 600,
  bbox: [minX, minY, maxX, maxY],
  crs: 'EPSG:3857',
  format: 'image/png',
  transparent: true
})
```

## WMTS Integration

### 1. Query WMTS Capabilities

```typescript
import { WmtsEndpoint } from '@camptocamp/ogc-client'

async function discoverWmtsLayers(serviceUrl: string) {
  const endpoint = await new WmtsEndpoint(serviceUrl).isReady()

  const layers = endpoint.getLayers()

  return layers.map(layer => ({
    name: layer.name,
    title: layer.title,
  }))
}
```

### 2. Add WMTS Layer to MapContext

```typescript
import type { MapContextLayerWmts } from '@geospatial-sdk/core'

async function addWmtsLayerFromService(
  serviceUrl: string,
  layerName: string,
  matrixSet: string = 'EPSG:3857'
) {
  const mapStore = useMapStore()
  const endpoint = await new WmtsEndpoint(serviceUrl).isReady()
  const layer = endpoint.getLayers().find(l => l.name === layerName)

  if (!layer) {
    throw new Error(`Layer ${layerName} not found`)
  }

  const mapContextLayer: MapContextLayerWmts = {
    type: 'wmts',
    id: `layerName`,
    url: serviceUrl,
    name: layerName,
    visibility: true,
    opacity: 1,
    version: 0,
    label: layer.title || layerName
  }
  mapContextLayer.extras = {
    extent: createViewFromLayer(mapContextLayer).extent,
  }

  mapStore.addLayer(mapContextLayer)
}
```

## WFS Integration

### 1. Query WFS Capabilities

```typescript
import { WfsEndpoint } from '@camptocamp/ogc-client'

async function discoverWfsLayers(serviceUrl: string) {
  const endpoint = await new WfsEndpoint(serviceUrl).isReady()

  const featureTypes = endpoint.getFeatureTypes()

  return featureTypes.map(ft => ({
    name: ft.name,
    title: ft.title,
    abstract: ft.abstract,
    boundingBox: ft.boundingBox,
    outputFormats: ft.outputFormats
  }))
}
```

### 2. Add WFS Layer to MapContext

```typescript
import type { MapContextLayerWfs } from '@geospatial-sdk/core'

async function addWfsLayerFromService(
  serviceUrl: string,
  featureTypeName: string
) {
  const mapStore = useMapStore()
  const endpoint = await new WfsEndpoint(serviceUrl).isReady()
  const featureType = endpoint.getFeatureTypes().find(ft => ft.name === featureTypeName)

  if (!featureType) {
    throw new Error(`Feature type ${featureTypeName} not found`)
  }

  const mapContextLayer: MapContextLayerWfs = {
    type: 'wfs',
    id: `featureTypeName`,
    url: serviceUrl,
    featureType: featureTypeName,
    visibility: true,
    label: featureType.title || featureTypeName,
    version: 0,
    style: {
      'fill-color': '#3388ff',
      'stroke-color': '#0066cc',
      'stroke-width': 2
    }
  }
  mapContextLayer.extras = {
    extent: createViewFromLayer(mapContextLayer).extent,
  }

  mapStore.addLayer(mapContextLayer)
}
```

## OGC API Features Integration

### 1. Query OGC API Collections

```typescript
import { OgcApiEndpoint } from '@camptocamp/ogc-client'

async function discoverOgcApiCollections(serviceUrl: string) {
  const endpoint = await new OgcApiEndpoint(serviceUrl).isReady()

  const collections = endpoint.getCollections()

  return collections.map(collection => ({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    extent: collection.extent,
    itemType: collection.itemType
  }))
}
```

### 2. Add OGC API Layer to MapContext

```typescript
import type { MapContextLayerOgcApi } from '@geospatial-sdk/core'

async function addOgcApiLayerFromService(
  serviceUrl: string,
  collectionId: string
) {
  const mapStore = useMapStore()
  const endpoint = await new OgcApiEndpoint(serviceUrl).isReady()
  const collection = endpoint.getCollections().find(c => c.id === collectionId)

  if (!collection) {
    throw new Error(`Collection ${collectionId} not found`)
  }

  const mapContextLayer: MapContextLayerOgcApi = {
    type: 'ogc-api',
    id: `ogc-api-${collectionId}-${Date.now()}`,
    url: serviceUrl,
    collection: collectionId,
    visibility: true,
    label: collection.title || collectionId,
    style: {
      'fill-color': '#ff8833',
      'stroke-color': '#cc6600'
    }
  }

  mapStore.addLayer(mapContextLayer)
}
```

## Vue Component: Service Browser

### Layer Discovery UI

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WmsEndpoint, WmtsEndpoint, WfsEndpoint } from '@camptocamp/ogc-client'
import { useMapStore } from '@/stores/map.store'

const serviceUrl = ref('')
const serviceType = ref<'wms' | 'wmts' | 'wfs'>('wms')
const availableLayers = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const mapStore = useMapStore()

async function discoverLayers() {
  loading.value = true
  error.value = null
  availableLayers.value = []

  try {
    let endpoint

    switch (serviceType.value) {
      case 'wms':
        endpoint = await new WmsEndpoint(serviceUrl.value)
        availableLayers.value = endpoint.getFlattenedLayers()
        break
      case 'wmts':
        endpoint = await new WmtsEndpoint(serviceUrl.value)
        availableLayers.value = endpoint.getLayers()
        break
      case 'wfs':
        endpoint = await new WfsEndpoint(serviceUrl.value)
        availableLayers.value = endpoint.getFeatureTypes()
        break
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to query service'
  } finally {
    loading.value = false
  }
}

function addLayerToMap(layer: any) {
  const mapContextLayer = {
    type: serviceType.value,
    id: `${serviceType.value}-${layer.name}-${Date.now()}`,
    url: serviceUrl.value,
    name: layer.name,
    visibility: true,
    label: layer.title || layer.name
  }

  mapStore.addLayer(mapContextLayer as any)
}
</script>

<template>
  <div class="service-browser">
    <h3>Add Layer from OGC Service</h3>

    <div class="input-group">
      <label>Service Type</label>
      <select v-model="serviceType">
        <option value="wms">WMS</option>
        <option value="wmts">WMTS</option>
        <option value="wfs">WFS</option>
      </select>
    </div>

    <div class="input-group">
      <label>Service URL</label>
      <input
        v-model="serviceUrl"
        type="text"
        placeholder="https://example.com/wms"
      />
    </div>

    <button @click="discoverLayers" :disabled="loading || !serviceUrl">
      {{ loading ? 'Loading...' : 'Discover Layers' }}
    </button>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="availableLayers.length" class="layer-list">
      <h4>Available Layers</h4>
      <div
        v-for="layer in availableLayers"
        :key="layer.name"
        class="layer-item"
      >
        <div class="layer-info">
          <strong>{{ layer.title || layer.name }}</strong>
          <p>{{ layer.abstract }}</p>
        </div>
        <button @click="addLayerToMap(layer)">
          Add to Map
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
```

## Error Handling

### Common Issues and Solutions

#### Invalid Service URL

```typescript
function validateServiceUrl(url: string, type: string): boolean {
  try {
    new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Basic validation for service type
  const urlLower = url.toLowerCase()
  if (type === 'wms' && !urlLower.includes('wms') && !urlLower.includes('service=wms')) {
    console.warn('URL may not be a WMS endpoint')
  }

  return true
}
```

#### Service Timeout

```typescript
async function queryServiceWithTimeout(
  url: string,
  type: string,
  timeoutMs: number = 10000
) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Service timeout')), timeoutMs)
  )

  const queryPromise = queryService(url, type)

  return Promise.race([queryPromise, timeoutPromise])
}
```

## Best Practices

### 2. Validate Service URLs

Always validate before querying:

```typescript
// ✅ Good: Validate first
try {
  validateServiceUrl(url, 'wms')
  const endpoint = await new WmsEndpoint(url)
} catch (error) {
  // Handle validation error
}
```

### 3. Handle Async Errors Gracefully

```typescript
// ✅ Good: Comprehensive error handling
async function addLayer() {
  try {
    const endpoint = await new WmsEndpoint(url)
    // ...
  } catch (error: any) {
    if (error.message.includes('CORS')) {
      showCorsError()
    } else if (error.message.includes('timeout')) {
      showTimeoutError()
    } else {
      showGenericError(error)
    }
  }
}
```

### 4. Show Loading States

```typescript
// ✅ Good: Inform user of async operations
const loading = ref(false)

async function discoverLayers() {
  loading.value = true
  try {
    const endpoint = await new WmsEndpoint(url)
    // ...
  } finally {
    loading.value = false
  }
}
```

### 5. Disable Workers When Needed

If you encounter `Referer` header issues or worker problems:

```typescript
// In main.ts or app initialization
import { enableFallbackWithoutWorker } from '@camptocamp/ogc-client'

enableFallbackWithoutWorker()
```

## Integration with geospatial-sdk

### Complete Workflow

```typescript
import { WmsEndpoint } from '@camptocamp/ogc-client'
import { useMapStore } from '@/stores/map.store'
import type { MapContextLayerWms } from '@geospatial-sdk/core'

async function addWmsLayerComplete(serviceUrl: string, layerName: string) {
  // 1. Query service capabilities using ogc-client
  const endpoint = await new WmsEndpoint(serviceUrl)
  const layer = endpoint.getLayers().find(l => l.name === layerName)

  if (!layer) {
    throw new Error(`Layer ${layerName} not found in service`)
  }

  // 2. Create MapContext layer configuration
  const mapContextLayer: MapContextLayerWms = {
    type: 'wms',
    id: `wms-${layerName}-${Date.now()}`,
    url: serviceUrl,
    name: layerName,
    visibility: true,
    opacity: 1,
    label: layer.title || layerName,
    // Optional: Add metadata from capabilities
    extras: {
      abstract: layer.abstract,
      boundingBox: layer.boundingBox,
      styles: layer.styles
    }
  }

  // 3. Add to Pinia store (MapContext)
  const mapStore = useMapStore()
  mapStore.addLayer(mapContextLayer)

  // 4. geospatial-sdk automatically renders the layer
  // (via MapContext watcher in MapView.vue)
}
```

## Common Use Cases

### Use Case 1: Add Multiple Layers from Catalog

```typescript
async function addLayersFromCatalog(
  serviceUrl: string,
  layerNames: string[]
) {
  const endpoint = await new WmsEndpoint(serviceUrl)
  const availableLayers = endpoint.getLayers()

  layerNames.forEach(name => {
    const layer = availableLayers.find(l => l.name === name)
    if (layer) {
      mapStore.addLayer({
        type: 'wms',
        id: `wms-${name}-${Date.now()}`,
        url: serviceUrl,
        name: name,
        visibility: true,
        label: layer.title || name
      })
    }
  })
}
```

### Use Case 2: User-Driven Layer Discovery

See the Vue component example above for a complete UI implementation.

### Use Case 3: Preset Service Configurations

```typescript
// src/config/services.ts
export const KNOWN_SERVICES = {
  osm: {
    type: 'wmts' as const,
    url: 'https://tile.openstreetmap.org/wmts',
    layers: ['osm']
  },
  geoserver: {
    type: 'wms' as const,
    url: 'https://demo.geoserver.org/geoserver/wms',
    layers: ['ne:countries', 'ne:populated_places']
  }
}

async function loadPresetService(key: keyof typeof KNOWN_SERVICES) {
  const config = KNOWN_SERVICES[key]
  // Query and add layers...
}
```

## Troubleshooting

### Service Won't Load

**Checklist:**
1. Verify URL is accessible (test in browser)
2. Check CORS headers (Network tab in DevTools)
3. Ensure service is returning valid XML/JSON
4. Try disabling workers: `enableFallbackWithoutWorker()`
5. Check service version compatibility
6. Check you have called the `isReady()` method

### Layer Not Appearing

**Checklist:**
1. Verify layer name matches capabilities
2. Check MapContext in Vue DevTools
3. Verify layer `visibility: true`
4. Check layer extent overlaps current view
5. Inspect network requests for errors

### Performance Issues

**Solutions:**
- Enable caching in services store
- Limit concurrent GetCapabilities requests
- Use WMTS instead of WMS when possible
- Implement pagination for large layer lists

## Resources

- **ogc-client Repository**: https://github.com/camptocamp/ogc-client
- **Documentation**: https://camptocamp.github.io/ogc-client/
- **geospatial-sdk**: See `.claude/skills/geospatial-sdk/SKILL.md`
- **OGC Standards**: https://www.ogc.org/standards/

## When to Use This Skill

Use this Skill when:
- Loading layers from WMS, WMTS, WFS, or OGC API services
- Implementing service discovery/browsing UI
- Working with GetCapabilities queries
- Adding external layers to MapContext
- Building a layer catalog or data browser
- Troubleshooting OGC service integration
- Converting OGC service responses to MapContext layers
