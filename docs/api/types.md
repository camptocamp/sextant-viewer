---
aside: false
---

# Types

Types utilisés dans l'API de `<sxt-viewer>`.

Les types `MapContextLayer`, `MapContextView` et `Extent` proviennent de `@geospatial-sdk/core` —
voir la [documentation geospatial-sdk](https://camptocamp.github.io/geospatial-sdk/api/) pour leur référence complète.

## ExtendedMapContext

Contexte complet de la carte, passé à `setInitialContext` et `setContext`, retourné par `getContext`.

```typescript
interface ExtendedMapContext {
  layers: MapLayer[]           // couches de données (WMS, WFS, GeoJSON, STAC…)
  backgroundLayers: MapLayer[] // couches de fond (fond de carte)
  view: MapContextView         // étendue courante ou centre+zoom
  dataSources?: DataSource[]   // index sondés pour le filtrage attributaire
}
```

## DataSource

Source de données déclarée dans le contexte, sondée pour détecter si les données d'une couche WMS sont indexées et donc filtrables par attributs.

```typescript
interface DataSource {
  url: string              // ex. 'https://sextant.ifremer.fr/geonetwork/index/features'
  type: 'geonetwork-index'
}
```

## MapLayer

Union de tous les types de couches supportés par le composant.

```typescript
type MapLayer = (MapContextLayer | MapLayerStac) & { error?: boolean }
```

- `MapContextLayer` — types standard geospatial-sdk : `xyz`, `wms`, `wmts`, `wfs`, `geojson`, `ogcapi`, `maplibre-style`, `geotiff`
- `MapLayerStac` — type spécifique au composant pour les collections STAC
- `error` — flag interne indiquant un échec de chargement

## MapLayerStac

Type de couche pour les collections [STAC](https://stacspec.org/).

```typescript
interface MapLayerStac extends MapContextBaseLayer {
  type: 'stac'
  url: string           // URL de la collection STAC
  collectionId?: string
  filters?: {
    dateRange?: { start: string; end: string }  // ISO 8601
    bbox?: [number, number, number, number]     // EPSG:4326
  }
}
```

## MapContextView

Vue définie par l'une des trois formes suivantes (depuis `@geospatial-sdk/core`) :

```typescript
type MapContextView =
  | { center: [number, number]; zoom: number }
  | { extent: [number, number, number, number] }  // [minX, minY, maxX, maxY] EPSG:4326
  | { geometry: GeoJSONGeometry }
  & { maxZoom?: number; maxExtent?: [number, number, number, number] }
```
