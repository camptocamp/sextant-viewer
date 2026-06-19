---
outline: deep
---

# Couches

Le composant supporte 9 types de couches, discriminés par la propriété `type`.

## Propriétés communes

Toutes les couches partagent les propriétés de `MapContextBaseLayer` :

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | `string` | Discriminant du type de couche (requis) |
| `label` | `string` | Nom affiché dans l'interface |
| `visibility` | `boolean` | Visibilité initiale |
| `opacity` | `number` | Opacité (0–1) |
| `attributions` | `string` | Texte de crédits affiché sur la carte |
| `hoverable` | `boolean` | Active la popup au survol |

Voir la [référence complète des types](https://camptocamp.github.io/geospatial-sdk/api/) dans la doc geospatial-sdk.

---

## `xyz` — Tuiles raster

```js
viewer.addLayer({
  type: 'xyz',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  visibility: true,
  opacity: 1,
  label: 'OpenStreetMap (XYZ)',
  attributions: '© OpenStreetMap contributors',
})
```

---

## `wms` — Web Map Service

```js
viewer.addLayer({
  type: 'wms',
  url: 'https://data.geopf.fr/wms-r/wms',
  name: 'INSEE.FILOSOFI.POPULATION',
  label: 'Population INSEE (WMS)',
  visibility: true,
  opacity: 0.7,
  attributions: '© IGN - INSEE',
})
```

---

## `wmts` — Web Map Tile Service

La couche est configurée automatiquement depuis le GetCapabilities.

```js
viewer.addLayer({
  type: 'wmts',
  url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities',
  name: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  label: 'PLANIGNV2 (WMTS)',
  visibility: true,
  opacity: 0.7,
  attributions: '© IGN',
})
```

---

## `wfs` — Web Feature Service

```js
viewer.addLayer(
  {
    type: 'wfs',
    url: 'https://data.lillemetropole.fr/geoserver/dsp_ilevia/ows?REQUEST=GetCapabilities&SERVICE=WFS&VERSION=2.0.0',
    featureType: 'ilevia_traceslignes',
    label: 'Lignes de bus Ilevia (WFS)',
    visibility: true,
    opacity: 0.8,
    attributions: '© MEL - Ilevia',
    hoverable: true,
  },
  true, // zoomToExtent
)
```

---

## `geojson` — Données vecteur GeoJSON

Deux variantes : par URL distante ou avec données embarquées.

### Par URL

```js
viewer.addLayer({
  type: 'geojson',
  url: 'https://data.lillemetropole.fr/data/ogcapi/collections/mobilite_et_transport:sc_schema_cyclable_pm35_2023/items?f=geojson&limit=-1',
  label: 'Schéma cyclable 2035 (GeoJSON)',
  visibility: true,
  opacity: 0.8,
  hoverable: true,
})
```

### Données embarquées

```js
viewer.addLayer(
  {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [3.06, 50.63] },
          properties: { name: 'Mon point' },
        },
      ],
    },
    label: 'Points locaux (GeoJSON)',
    visibility: true,
    hoverable: true,
    style: {
      'circle-fill-color': '#888888',
      'circle-radius': 10,
      'circle-stroke-color': 'black',
      'circle-stroke-width': 3,
    },
  },
  true, // zoomToExtent
)
```

::: warning Zoom sur l'emprise
`zoomToExtent: true` ne fonctionne qu'avec les données embarquées (`data`). Pour une couche GeoJSON par URL, le zoom n'est pas supporté.
:::

---

## `ogcapi` — OGC API Features

```js
viewer.addLayer(
  {
    type: 'ogcapi',
    url: 'https://data.lillemetropole.fr/data/ogcapi/',
    collection: 'mobilite_et_transport:pm2035_action_sdvelo_pointsdurs',
    options: {
      outputFormat: 'application/geo+json',
      limit: -1,
    },
    label: 'Schéma cyclable - points durs (OGC API)',
    visibility: true,
    opacity: 0.8,
  },
  true, // zoomToExtent
)
```

---

## `maplibre-style` — Style MapLibre GL

```js
viewer.addLayer({
  type: 'maplibre-style',
  styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  label: 'Voyager (Maplibre style)',
})
```

---

## `geotiff` — GeoTIFF (Cloud Optimized)

```js
viewer.addLayer(
  {
    type: 'geotiff',
    url: 'https://oin-hotosm-temp.s3.us-east-1.amazonaws.com/66e43a1ecd0baa0001b62135/0/66e43a1ecd0baa0001b62136.tif',
    label: 'COG Brest (OpenAerialMap)',
    visibility: true,
    opacity: 1,
    attributions: '© OpenAerialMap contributors, CC-BY 4.0',
  },
  true, // zoomToExtent
)
```

---

## `stac` — STAC Collection

Type spécifique au composant pour les collections [STAC](https://stacspec.org/). Supporte le filtrage temporel et spatial, la pagination et l'affichage des items.

```js
viewer.addLayer(
  {
    type: 'stac',
    url: 'https://stac-pg-api.ifremer.fr/collections/AVHRR_SST_METOP_B_OSISAF_L2P_v1_0',
    label: 'EUMETSAT OSI SAF (STAC)',
    visibility: true,
    hoverable: true,
  },
  true, // zoomToExtent
)
```

Voir [MapLayerStac](/api/types#maplayer-stac) pour les options de filtrage.
