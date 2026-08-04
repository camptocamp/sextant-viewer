---
outline: deep
---

# Contexte de carte

Le contexte (`ExtendedMapContext`) est la source de vérité de l'état de la carte.

## Structure

```typescript
interface ExtendedMapContext {
  layers: MapLayer[]              // couches de données
  backgroundLayers: MapLayer[]    // couches de fond (fond de carte)
  view: MapContextView            // étendue ou centre+zoom
  dataSources?: DataSource[]      // index sondés pour le filtrage attributaire
}
```

### `view`

La vue peut être définie de trois façons :

```typescript
// Par centre et niveau de zoom
{ center: [longitude, latitude], zoom: number }

// Par emprise (bounding box EPSG:4326)
{ extent: [minX, minY, maxX, maxY] }

// Par géométrie GeoJSON
{ geometry: GeoJSONGeometry }
```

Options communes : `maxZoom?: number`, `maxExtent?: [minX, minY, maxX, maxY]`.

### `dataSources`

Index Geonetwork sondés pour détecter les couches WMS filtrables par attributs. Pour chaque couche WMS du contexte, le composant remonte à sa fiche de métadonnées Geonetwork : si la ressource WFS associée porte un profil de filtrage, un onglet **Filtre** est proposé dans le détail de la couche.

```js
{
  dataSources: [
    { url: 'https://sextant.ifremer.fr/geonetwork/index/features', type: 'geonetwork-index' },
  ],
  layers: [{ type: 'wms', url: 'https://...', name: 'ma-couche' }],
  view: { center: [-4.56, 48.36], zoom: 8 },
}
```

La détection est asynchrone et non bloquante : la couche s'affiche immédiatement, l'onglet **Filtre** apparaît si et quand l'index répond.

## `setInitialContext` vs `setContext`

| | `setInitialContext` | `setContext` |
|--|---------------------|--------------|
| Enrichissement des couches | ✓ (ex. STAC) | ✗ |
| Usage recommandé | Premier chargement | Remplacement complet |

```js
// Au chargement de la page
await viewer.setInitialContext({
  backgroundLayers: [{ type: 'xyz', url: '...', visibility: true, opacity: 1 }],
  layers: [{ type: 'wms', url: 'https://...', name: 'ma-couche' }],
  view: { center: [2.35, 48.85], zoom: 10 },
})

// Remplacement complet (sans couches STAC)
await viewer.setContext(nouveauContexte)
```

Le remplacement est total : ce que le contexte n'inclut pas est supprimé — un contexte sans `dataSources` efface celles déjà déclarées.

## `getContext`

Retourne l'état actuel de la carte. Les métadonnées internes (`id`, `version`) sont supprimées — le résultat peut être re-passé à `setContext` ou sérialisé.

```js
const context = viewer.getContext()
// { layers: [...], backgroundLayers: [...], view: { extent: [...] } }
```

## `setView`

Met à jour uniquement la vue sans modifier les couches.

```js
// Zoom sur une position
await viewer.setView({ center: [2.35, 48.85], zoom: 14 })

// Zoom sur une emprise
await viewer.setView({ extent: [-5, 41, 9, 51] })
```
