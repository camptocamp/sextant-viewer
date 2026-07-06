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
- **STAC API** (SpatioTemporal Asset Catalog) - Spatio-temporal asset and metadata discovery

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
  OgcApiEndpoint,
  StacEndpoint,
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

async function addWmsLayerFromService(serviceUrl: string, layerName: string) {
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
  transparent: true,
})
```

## WMTS Integration

### 1. Query WMTS Capabilities

```typescript
import { WmtsEndpoint } from '@camptocamp/ogc-client'

async function discoverWmtsLayers(serviceUrl: string) {
  const endpoint = await new WmtsEndpoint(serviceUrl).isReady()

  const layers = endpoint.getLayers()

  return layers.map((layer) => ({
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
  matrixSet: string = 'EPSG:3857',
) {
  const mapStore = useMapStore()
  const endpoint = await new WmtsEndpoint(serviceUrl).isReady()
  const layer = endpoint.getLayers().find((l) => l.name === layerName)

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
    label: layer.title || layerName,
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

  return featureTypes.map((ft) => ({
    name: ft.name,
    title: ft.title,
    abstract: ft.abstract,
    boundingBox: ft.boundingBox,
    outputFormats: ft.outputFormats,
  }))
}
```

### 2. Add WFS Layer to MapContext

```typescript
import type { MapContextLayerWfs } from '@geospatial-sdk/core'

async function addWfsLayerFromService(serviceUrl: string, featureTypeName: string) {
  const mapStore = useMapStore()
  const endpoint = await new WfsEndpoint(serviceUrl).isReady()
  const featureType = endpoint.getFeatureTypes().find((ft) => ft.name === featureTypeName)

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
      'stroke-width': 2,
    },
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

  return collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    extent: collection.extent,
    itemType: collection.itemType,
  }))
}
```

### 2. Add OGC API Layer to MapContext

```typescript
import type { MapContextLayerOgcApi } from '@geospatial-sdk/core'

async function addOgcApiLayerFromService(serviceUrl: string, collectionId: string) {
  const mapStore = useMapStore()
  const endpoint = await new OgcApiEndpoint(serviceUrl).isReady()
  const collection = endpoint.getCollections().find((c) => c.id === collectionId)

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
      'stroke-color': '#cc6600',
    },
  }

  mapStore.addLayer(mapContextLayer)
}
```

## STAC API Integration

**STAC (SpatioTemporal Asset Catalog)** is a specification for describing geospatial assets with rich metadata, enabling search and discovery of imagery, point clouds, SAR data, and other remote sensing data.

### Understanding STAC Concepts

- **STAC Catalog**: Root entry point, contains links to collections
- **STAC Collection**: A group of related items (e.g., "Sentinel-2 L2A")
- **STAC Item**: Individual asset with geometry, datetime, and properties
- **STAC Asset**: Actual data files (COG, GeoTIFF, etc.) linked from items

### StacEndpoint API

The `StacEndpoint` class provides methods to interact with STAC APIs:

```typescript
import { StacEndpoint } from '@camptocamp/ogc-client'

// Create endpoint
const endpoint = await new StacEndpoint('https://earth-search.aws.element84.com/v1').isReady()
```

### Key Methods

#### Get All Collection IDs

```typescript
const collectionIds = await endpoint.allCollections
// Returns: string[] - array of collection IDs

collectionIds.forEach((id) => {
  console.log('Collection ID:', id)
})
```

#### Get Single Collection

```typescript
const collection = await endpoint.getCollection('sentinel-2-l2a')

console.log('Collection ID:', collection.id)
console.log('Title:', collection.title)
console.log('Description:', collection.description)
console.log('License:', collection.license)
console.log('Extent:', collection.extent)
console.log('Keywords:', collection.keywords)
console.log('Providers:', collection.providers)
```

#### Query Items from Collection

```typescript
// Get items as array (convenience method)
const items = await endpoint.getCollectionItems('sentinel-2-l2a', {
  bbox: [-180, -90, 180, 90], // [west, south, east, north]
  datetime: {
    // Date range
    start: new Date('2023-01-01'),
    end: new Date('2023-12-31'),
  },
  limit: 10, // Max results
})

items.forEach((item) => {
  console.log('Item ID:', item.id)
  console.log('Datetime:', item.properties.datetime)
  console.log('Geometry:', item.geometry)
  console.log('Assets:', Object.keys(item.assets))
})

// Or get full response with pagination links
const response = await endpoint.getCollectionItemsResponse('sentinel-2-l2a', {
  limit: 10,
})

console.log('Type:', response.type) // 'FeatureCollection'
console.log('Features:', response.features)
console.log('Number matched:', response.numberMatched)
console.log('Number returned:', response.numberReturned)

// Check for pagination
const nextLink = response.links?.find((link) => link.rel === 'next')
if (nextLink) {
  console.log('Next page:', nextLink.href)
}
```

#### Get Single Item by ID

```typescript
const item = await endpoint.getCollectionItem(
  'sentinel-2-l2a', // Collection ID
  'S2A_MSIL2A_20231201T103321_...', // Item ID
)

console.log('Cloud cover:', item.properties['eo:cloud_cover'])
console.log('Assets:', item.assets)
```

### STAC Collection Type Definition

```typescript
interface StacCollection {
  id: string // Unique collection identifier
  title?: string // Human-readable title
  description?: string // Detailed description
  license: string // License (e.g., "proprietary", "CC-BY-4.0")
  extent: {
    spatial: {
      bbox: number[][] // [[west, south, east, north]]
    }
    temporal: {
      interval: (string | null)[][] // [["2015-01-01T00:00:00Z", null]]
    }
  }
  keywords?: string[] // Search keywords
  providers?: Array<{
    name: string
    roles: string[] // ["producer", "processor", "host"]
    url?: string
  }>
  summaries?: Record<string, any> // Available properties summary
  links: Array<{
    rel: string
    href: string
    type?: string
  }>
  assets?: Record<
    string,
    {
      // Collection-level assets
      href: string
      title?: string
      type?: string
    }
  >
}
```

### STAC Item/Feature Type Definition

```typescript
interface StacItem {
  type: 'Feature'
  id: string
  collection: string
  geometry: GeoJSON.Geometry
  bbox: number[] // [west, south, east, north]
  properties: {
    datetime: string // ISO 8601 datetime
    [key: string]: any // Additional properties (eo:cloud_cover, etc.)
  }
  assets: Record<
    string,
    {
      href: string // URL to actual data file
      title?: string
      type?: string // MIME type
      roles?: string[] // ["data", "thumbnail", "metadata"]
      'eo:bands'?: Array<{
        name: string
        common_name?: string
      }>
    }
  >
  links: Array<{
    rel: string
    href: string
    type?: string
  }>
}
```

### 1. Browse STAC Collections

```typescript
import { StacEndpoint } from '@camptocamp/ogc-client'
import { ref } from 'vue'

const stacUrl = ref('https://earth-search.aws.element84.com/v1')
const collections = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function loadCollections() {
  loading.value = true
  error.value = null

  try {
    const endpoint = new StacEndpoint(stacUrl.value)
    const collectionIds = await endpoint.allCollections

    // Fetch full collection details for each ID
    collections.value = await Promise.all(collectionIds.map((id) => endpoint.getCollection(id)))

    console.log(`Loaded ${collections.value.length} collections`)
  } catch (e: any) {
    error.value = e.message || 'Failed to load STAC collections'
    console.error('STAC error:', e)
  } finally {
    loading.value = false
  }
}
```

### 2. Display Collection Metadata

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  collection: any
}>()

const spatialExtent = computed(() => {
  const bbox = props.collection.extent?.spatial?.bbox?.[0]
  if (!bbox) return null
  return {
    west: bbox[0],
    south: bbox[1],
    east: bbox[2],
    north: bbox[3],
  }
})

const temporalExtent = computed(() => {
  const interval = props.collection.extent?.temporal?.interval?.[0]
  if (!interval) return null
  return {
    start: interval[0],
    end: interval[1] || 'Present',
  }
})
</script>

<template>
  <div class="collection-card">
    <h3>{{ collection.title || collection.id }}</h3>
    <p>{{ collection.description }}</p>

    <div class="metadata">
      <div v-if="collection.license"><strong>License:</strong> {{ collection.license }}</div>

      <div v-if="spatialExtent">
        <strong>Spatial Extent:</strong>
        <code
          >{{ spatialExtent.west }}, {{ spatialExtent.south }} to {{ spatialExtent.east }},
          {{ spatialExtent.north }}</code
        >
      </div>

      <div v-if="temporalExtent">
        <strong>Temporal Extent:</strong>
        {{ temporalExtent.start }} → {{ temporalExtent.end }}
      </div>

      <div v-if="collection.keywords?.length">
        <strong>Keywords:</strong>
        <span v-for="kw in collection.keywords" :key="kw" class="keyword">
          {{ kw }}
        </span>
      </div>
    </div>
  </div>
</template>
```

### 3. Search STAC Items

```typescript
import { StacEndpoint } from '@camptocamp/ogc-client'

async function searchStacItems(
  catalogUrl: string,
  collectionId: string,
  bbox: number[],
  dateRange: { start: string; end: string },
) {
  const endpoint = new StacEndpoint(catalogUrl)

  // Search for items matching criteria
  const results = await endpoint.getCollectionItemsResponse(collectionId, {
    bbox: bbox, // [west, south, east, north]
    datetime: {
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    },
    limit: 50,
  })

  console.log(`Found ${results.numberMatched || 'unknown'} items`)
  console.log(`Returned ${results.numberReturned || results.features.length} items`)

  return results.features.map((item) => ({
    id: item.id,
    datetime: item.properties.datetime,
    cloudCover: item.properties['eo:cloud_cover'],
    geometry: item.geometry,
    thumbnailUrl: item.assets.thumbnail?.href,
    dataUrl: item.assets.data?.href || item.assets.visual?.href,
  }))
}
```

### 4. Visualize STAC Items on Map

STAC items can be visualized in multiple ways:

#### Option A: Add as GeoJSON Layer

```typescript
import type { MapContextLayerGeojson } from '@geospatial-sdk/core'

async function addStacItemsAsGeoJson(catalogUrl: string, collectionId: string, bbox: number[]) {
  const endpoint = new StacEndpoint(catalogUrl)
  const results = await endpoint.getCollectionItemsResponse(collectionId, {
    bbox: bbox,
    limit: 100,
  })

  // Create GeoJSON FeatureCollection from STAC items
  const geojsonLayer: MapContextLayerGeojson = {
    type: 'geojson',
    id: `stac-items-${collectionId}-${Date.now()}`,
    data: {
      type: 'FeatureCollection',
      features: results.features,
    },
    visibility: true,
    label: `${collectionId} Items`,
    version: 0,
    style: {
      'fill-color': 'rgba(255, 0, 0, 0.2)',
      'stroke-color': '#ff0000',
      'stroke-width': 2,
    },
  }

  mapStore.addLayer(geojsonLayer)
}
```

#### Option B: Add COG Assets as XYZ Tiles

```typescript
import type { MapContextLayerXyz } from '@geospatial-sdk/core'

async function addStacCogAsXyz(item: any, assetKey: string = 'visual') {
  const asset = item.assets[assetKey]

  if (!asset || !asset.href.endsWith('.tif')) {
    throw new Error('Asset is not a COG (Cloud Optimized GeoTIFF)')
  }

  // Use a COG tile server (e.g., titiler)
  const tileUrl = `https://titiler.xyz/cog/tiles/{z}/{x}/{y}?url=${encodeURIComponent(asset.href)}`

  const layer: MapContextLayerXyz = {
    type: 'xyz',
    id: `stac-cog-${item.id}`,
    url: tileUrl,
    visibility: true,
    opacity: 1,
    label: `${item.collection} - ${item.id}`,
    version: 0,
  }

  mapStore.addLayer(layer)
}
```

### 5. Complete STAC Browser Component

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { StacEndpoint } from '@camptocamp/ogc-client'
import { useMapStore } from '@/stores/map.store'

const catalogUrl = ref('https://earth-search.aws.element84.com/v1')
const collections = ref<any[]>([])
const selectedCollection = ref<string | null>(null)
const searchResults = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const mapStore = useMapStore()

async function loadCollections() {
  loading.value = true
  error.value = null

  try {
    const endpoint = new StacEndpoint(catalogUrl.value)
    const collectionIds = await endpoint.allCollections

    // Fetch full collection details
    collections.value = await Promise.all(collectionIds.map((id) => endpoint.getCollection(id)))
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function searchItems() {
  if (!selectedCollection.value) return

  loading.value = true
  error.value = null

  try {
    const endpoint = new StacEndpoint(catalogUrl.value)

    // Get current map extent for bbox
    const view = mapStore.context?.view
    const bbox = view?.extent || [-180, -90, 180, 90]

    const results = await endpoint.getCollectionItemsResponse(selectedCollection.value, {
      bbox: bbox,
      limit: 20,
    })

    searchResults.value = results.features
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function addItemToMap(item: any) {
  // Add item footprint as GeoJSON
  mapStore.addLayer({
    type: 'geojson',
    id: `stac-item-${item.id}`,
    data: {
      type: 'FeatureCollection',
      features: [item],
    },
    visibility: true,
    label: `STAC: ${item.id}`,
    version: 0,
    style: {
      'fill-color': 'rgba(0, 150, 255, 0.1)',
      'stroke-color': '#0096ff',
      'stroke-width': 2,
    },
  })
}

function viewItemDetails(item: any) {
  console.log('STAC Item:', item)
  console.log('Properties:', item.properties)
  console.log('Assets:', item.assets)
}
</script>

<template>
  <div class="stac-browser">
    <h3>STAC Catalog Browser</h3>

    <div class="input-group">
      <label>Catalog URL</label>
      <input v-model="catalogUrl" type="text" />
      <button @click="loadCollections" :disabled="loading">
        {{ loading ? 'Loading...' : 'Connect' }}
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="collections.length" class="collections">
      <h4>Collections ({{ collections.length }})</h4>
      <select v-model="selectedCollection" @change="searchItems">
        <option :value="null">Select a collection</option>
        <option v-for="col in collections" :key="col.id" :value="col.id">
          {{ col.title || col.id }}
        </option>
      </select>
    </div>

    <div v-if="searchResults.length" class="results">
      <h4>Items ({{ searchResults.length }})</h4>
      <div v-for="item in searchResults" :key="item.id" class="item-card">
        <div class="item-info">
          <strong>{{ item.id }}</strong>
          <p>{{ item.properties.datetime }}</p>
          <p v-if="item.properties['eo:cloud_cover']">
            Cloud Cover: {{ item.properties['eo:cloud_cover'] }}%
          </p>
        </div>
        <div class="item-actions">
          <button @click="addItemToMap(item)">Add to Map</button>
          <button @click="viewItemDetails(item)">Details</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stac-browser {
  padding: 1rem;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.25rem;
}

.input-group input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.error {
  color: red;
  padding: 0.5rem;
  background: #fee;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.collections,
.results {
  margin-top: 1.5rem;
}

.item-card {
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
}

.item-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
```

### 6. Advanced STAC Queries

#### Filter by Date Range and Cloud Cover

```typescript
async function searchCloudFreeImagery(
  catalogUrl: string,
  collectionId: string,
  bbox: number[],
  maxCloudCover: number = 10,
) {
  const endpoint = new StacEndpoint(catalogUrl)

  // Note: Query filters depend on server support - not all STAC APIs support them
  const results = await endpoint.getCollectionItemsResponse(collectionId, {
    bbox: bbox,
    datetime: {
      start: new Date('2023-06-01'),
      end: new Date('2023-08-31'),
    },
    limit: 50,
    // Add query parameters as URL params if server supports them
    query: `eo:cloud_cover<${maxCloudCover}`,
  })

  return results.features
}
```

#### Pagination Through Results

```typescript
async function getAllItemsInCollection(catalogUrl: string, collectionId: string) {
  const endpoint = new StacEndpoint(catalogUrl)
  const allItems: any[] = []
  const limit = 100

  // Get first page
  let response = await endpoint.getCollectionItemsResponse(collectionId, {
    limit: limit,
  })

  allItems.push(...response.features)

  // Follow pagination links
  while (response.links) {
    const nextLink = response.links.find((link) => link.rel === 'next')
    if (!nextLink) break

    // Use static method to fetch from URL
    response = await StacEndpoint.getItemsFromUrl(nextLink.href)
    allItems.push(...response.features)
  }

  return allItems
}
```

### 7. Working with STAC Assets

```typescript
function extractUsefulAssets(item: any) {
  const assets = item.assets

  return {
    thumbnail: assets.thumbnail?.href,
    preview: assets.preview?.href,
    visual: assets.visual?.href, // RGB composite
    data: assets.data?.href, // Original data
    metadata: assets.metadata?.href,

    // Specific bands (for multi-spectral imagery)
    red: assets.red?.href || assets.B04?.href,
    green: assets.green?.href || assets.B03?.href,
    blue: assets.blue?.href || assets.B02?.href,
    nir: assets.nir?.href || assets.B08?.href,

    // Cloud Optimized GeoTIFF check
    isCog: Object.values(assets).some(
      (asset: any) => asset.type === 'image/tiff; application=geotiff; profile=cloud-optimized',
    ),
  }
}
```

### 8. STAC Collection Statistics

```typescript
function analyzeCollection(collection: any) {
  const summaries = collection.summaries || {}

  return {
    id: collection.id,
    title: collection.title,
    itemCount: collection.item_count,

    // Temporal coverage
    startDate: collection.extent.temporal.interval[0][0],
    endDate: collection.extent.temporal.interval[0][1],

    // Available properties
    cloudCoverRange: summaries['eo:cloud_cover'],
    platforms: summaries.platform,
    instruments: summaries.instruments,

    // Spatial coverage
    bbox: collection.extent.spatial.bbox[0],

    // Available bands
    bands: summaries['eo:bands']?.map((b: any) => b.name),
  }
}
```

## Vue Component: Service Browser

### Layer Discovery UI

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WmsEndpoint, WmtsEndpoint, WfsEndpoint, StacEndpoint } from '@camptocamp/ogc-client'
import { useMapStore } from '@/stores/map.store'

const serviceUrl = ref('')
const serviceType = ref<'wms' | 'wmts' | 'wfs' | 'stac'>('wms')
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
        endpoint = await new WmsEndpoint(serviceUrl.value).isReady()
        availableLayers.value = endpoint.getLayers()
        break
      case 'wmts':
        endpoint = await new WmtsEndpoint(serviceUrl.value).isReady()
        availableLayers.value = endpoint.getLayers()
        break
      case 'wfs':
        endpoint = await new WfsEndpoint(serviceUrl.value).isReady()
        availableLayers.value = endpoint.getFeatureTypes()
        break
      case 'stac':
        endpoint = new StacEndpoint(serviceUrl.value)
        const collectionIds = await endpoint.allCollections
        availableLayers.value = await Promise.all(
          collectionIds.map((id) => endpoint.getCollection(id)),
        )
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
    id: `${serviceType.value}-${layer.name || layer.id}-${Date.now()}`,
    url: serviceUrl.value,
    name: layer.name || layer.id,
    visible: true,
    label: layer.title || layer.name || layer.id,
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
        <option value="stac">STAC</option>
      </select>
    </div>

    <div class="input-group">
      <label>Service URL</label>
      <input
        v-model="serviceUrl"
        type="text"
        :placeholder="
          serviceType === 'stac'
            ? 'https://earth-search.aws.element84.com/v1'
            : 'https://example.com/wms'
        "
      />
    </div>

    <button @click="discoverLayers" :disabled="loading || !serviceUrl">
      {{
        loading ? 'Loading...' : serviceType === 'stac' ? 'Discover Collections' : 'Discover Layers'
      }}
    </button>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="availableLayers.length" class="layer-list">
      <h4>{{ serviceType === 'stac' ? 'Available Collections' : 'Available Layers' }}</h4>
      <div v-for="layer in availableLayers" :key="layer.name || layer.id" class="layer-item">
        <div class="layer-info">
          <strong>{{ layer.title || layer.name || layer.id }}</strong>
          <p>{{ layer.abstract || layer.description }}</p>
        </div>
        <button @click="addLayerToMap(layer)">Add to Map</button>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
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
async function queryServiceWithTimeout(url: string, type: string, timeoutMs: number = 10000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Service timeout')), timeoutMs),
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
  const layer = endpoint.getLayers().find((l) => l.name === layerName)

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
      styles: layer.styles,
    },
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
async function addLayersFromCatalog(serviceUrl: string, layerNames: string[]) {
  const endpoint = await new WmsEndpoint(serviceUrl)
  const availableLayers = endpoint.getLayers()

  layerNames.forEach((name) => {
    const layer = availableLayers.find((l) => l.name === name)
    if (layer) {
      mapStore.addLayer({
        type: 'wms',
        id: `wms-${name}-${Date.now()}`,
        url: serviceUrl,
        name: name,
        visible: true,
        label: layer.title || name,
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
    layers: ['osm'],
  },
  geoserver: {
    type: 'wms' as const,
    url: 'https://demo.geoserver.org/geoserver/wms',
    layers: ['ne:countries', 'ne:populated_places'],
  },
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

- Loading layers from WMS, WMTS, WFS, OGC API, or STAC services
- Implementing service discovery/browsing UI
- Working with GetCapabilities queries or STAC catalog/collection endpoints
- Searching and filtering STAC items (satellite imagery, point clouds, etc.)
- Adding external layers to MapContext
- Building a layer catalog, data browser, or STAC asset explorer
- Troubleshooting OGC service integration
- Converting OGC service responses to MapContext layers
- Discovering and visualizing spatio-temporal assets from STAC catalogs
- Working with Cloud Optimized GeoTIFFs (COGs) or other remote sensing data
