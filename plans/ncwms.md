# Plan : Implémentation NcWMS dans le viewer

## Contexte

NcWMS est un serveur WMS étendu exposant des variables scientifiques (température, salinité…) avec rendu personnalisable. sextant-geonetwork implémentait 5 fonctionnalités : changement de palette, échelle logarithmique, détection automatique de plage, légende dynamique, plage de couleur.

Ce plan s'appuie sur la branche `wms_time` (viewer + geospatial-sdk), déjà en place, qui établit le pattern à suivre :

- Pattern viewer établi : détection dans `enrichLayer()` → stockage dans `extras` → `layer.utils.ts` → composable → composant
- `dimensionValues` est réservé aux **vraies dimensions WMS** déclarées dans le GetCapabilities (`TIME`, `ELEVATION`) — axes des données, pas du rendu
- `COLORSCALERANGE` et `LOGSCALE` sont des **paramètres vendor NcWMS** (rendu), pas des dimensions → ils passent par un nouveau champ `customParams` dans le SDK

---

## Prérequis : modification du geospatial-sdk (branche `wms_time`)

Modification minimale dans deux fichiers :

### `packages/core/lib/model/map-context.ts`
```typescript
export interface MapContextLayerWms extends MapContextBaseLayer {
  // ...champs existants...
  customParams?: Record<string, string>  // vendor params non-standard (ex: NcWMS)
}
```

### `packages/openlayers/lib/map/wms-params.ts`
Ajouter le spread de `customParams` dans `buildWmsParams()` :
```typescript
return {
  LAYERS: layerModel.name,
  ...(layerModel.format && { FORMAT: layerModel.format }),
  ...(layerModel.style && { STYLES: layerModel.style }),
  ...(layerModel.dimensionValues && ...),  // existant — vraies dimensions WMS
  ...(layerModel.customParams ?? {}),      // ← ajouter : vendor params
}
```

**Liaison** :
```bash
# Depuis le viewer, via `npm link` (implique un lien global / symlink)
npm link ../geospatial-sdk/packages/core ../geospatial-sdk/packages/openlayers
```

---

## Étape 1 : Types et utilitaires NcWMS

### Nouveau fichier `src/types/ncwms.types.ts`

```typescript
export interface NcwmsInfo {
  scaleRange: [number, number]
  palettes: string[]
  defaultPalette?: string
  supportedStyles: string[]  // 'boxfill', 'contour', ...
  units: string
  bbox: [number, number, number, number]
}
```

### Nouveau fichier `src/utils/ncwms.utils.ts`

Fonctions pures, aucune dépendance store :

**`fetchNcwmsInfo(url, layerName)`** → `Promise<NcwmsInfo | null>`
- `GET {url}?request=GetMetadata&item=layerDetails&layerName={layerName}`
- Retourne `null` si réponse non-JSON ou sans `scaleRange`/`palettes`

**`fetchAutoColorRange(url, layerName, bbox, dimensionValues?)`** → `Promise<{ min: number; max: number }>`
- `GET {url}?request=GetMetadata&item=minmax&width=50&height=50&srs=EPSG:4326&layers={}&bbox={}`
- Passe TIME et ELEVATION si présents dans `dimensionValues`

**`buildNcwmsStyles(ncInfo)`** → `Record<string, string>`
- Pour `boxfill` : `{ rainbow: 'boxfill/rainbow', occam: 'boxfill/occam', … }`
- Pour `contour` : `{ contour: 'contour' }`

**`buildLegendUrl(wmsUrl, layerName, style, colorScaleRange, logScale)`** → `string`
- Construit une URL `GetLegendGraphic` avec `STYLES`, `COLORSCALERANGE`, `LOGSCALE`

**`enrichNcwmsLayer(layer)`** → `Promise<MapContextLayerWms>` ← suit le pattern `enrichStacLayer`
```typescript
export async function enrichNcwmsLayer(
  layer: MapContextLayerWms,
): Promise<MapContextLayerWms> {
  const ncwmsInfo = await fetchNcwmsInfo(layer.url, layer.name)
  if (!ncwmsInfo) return layer
  const defaultPalette = ncwmsInfo.defaultPalette ?? ncwmsInfo.palettes[0]
  const styles = buildNcwmsStyles(ncwmsInfo)
  return {
    ...layer,
    style: styles[defaultPalette],        // → STYLES (champ dédié du SDK)
    customParams: {                        // vendor params NcWMS, pas des dimensions WMS
      COLORSCALERANGE: `${ncwmsInfo.scaleRange[0]},${ncwmsInfo.scaleRange[1]}`,
      LOGSCALE: 'false',
    },
    extras: { ...layer.extras, ncwmsInfo },
  }
}
```

---

## Étape 2 : Détection et enrichissement

### Modification `src/utils/layer.utils.ts`
Même pattern que `getWmsTimeDimension` :
```typescript
export function getNcwmsInfo(layer: MapLayer): NcwmsInfo | null {
  if (layer.type !== 'wms') return null
  return (layer.extras?.ncwmsInfo as NcwmsInfo) ?? null
}
```

### Modification `src/stores/map.store.ts`
Dans `enrichLayer()`, coordonner avec l'enrichissement TIME existant. Les deux appels peuvent tourner en parallèle (WmsEndpoint pour TIME, fetchNcwmsInfo pour NcWMS) :
```typescript
if (layer.type === 'wms') {
  const [wmsEnriched, ncwmsEnriched] = await Promise.all([
    enrichWmsTime(layerWithVersionAndId),   // logique TIME existante, extraite
    enrichNcwmsLayer(layerWithVersionAndId),
  ])
  return merge(wmsEnriched, ncwmsEnriched)  // fusionner extras + dimensionValues
}
```

> Alternative plus simple si le refactor TIME/NcWMS en parallèle est trop invasif : appeler `enrichNcwmsLayer` séquentiellement après le bloc TIME existant.

---

## Étape 3 : Composable `useNcwmsLayer`

### Nouveau fichier `src/composables/useNcwmsLayer.ts`
Même pattern que `useWmsTimeDimension` (computed getter/setter → `mapStore.updateLayer`).

```typescript
export function useNcwmsLayer(layer: MaybeRefOrGetter<MapLayer>) {
  const mapStore = useMapStore()

  const ncwmsInfo = computed(() => getNcwmsInfo(toValue(layer)))
  const styles = computed(() => buildNcwmsStyles(ncwmsInfo.value!))

  // Palette → layer.style ('boxfill/rainbow')
  const palette = computed<string>({
    get: () => {
      const style = (toValue(layer) as MapContextLayerWms).style ?? ''
      // 'boxfill/rainbow' → 'rainbow', 'contour' → 'contour'
      return style.includes('/') ? style.split('/')[1] : style
    },
    set: (value) =>
      mapStore.updateLayer(toValue(layer), { style: styles.value[value] } as Partial<MapLayer>),
  })

  // LOGSCALE → customParams (vendor param, pas une dimension WMS)
  const logScale = computed<boolean>({
    get: () => (toValue(layer) as MapContextLayerWms).customParams?.LOGSCALE === 'true',
    set: (value) => updateCustomParam({ LOGSCALE: String(value) }),
  })

  // COLORSCALERANGE → customParams (vendor param, pas une dimension WMS)
  const colorScaleRange = computed<[number, number]>({
    get: () => {
      const raw = (toValue(layer) as MapContextLayerWms).customParams?.COLORSCALERANGE ?? ''
      const [min, max] = raw.split(',').map(Number)
      return [min ?? 0, max ?? 1]
    },
    set: ([min, max]) => updateCustomParam({ COLORSCALERANGE: `${min},${max}` }),
  })

  function updateCustomParam(patch: Record<string, string>) {
    const l = toValue(layer) as MapContextLayerWms
    mapStore.updateLayer(l as MapLayer, {
      customParams: { ...l.customParams, ...patch },
    } as Partial<MapLayer>)
  }

  async function autoColorRange(extent: [number, number, number, number]) {
    const l = toValue(layer) as MapContextLayerWms
    const bounds = await fetchAutoColorRange(l.url, l.name, extent, l.dimensionValues)
    colorScaleRange.value = [bounds.min, bounds.max]
  }

  const legendUrl = computed(() => {
    const l = toValue(layer) as MapContextLayerWms
    return buildLegendUrl(l.url, l.name, l.style ?? '', colorScaleRange.value, logScale.value)
  })

  return { ncwmsInfo, styles, palette, logScale, colorScaleRange, autoColorRange, legendUrl }
}
```

---

## Étape 4 : Composant UI

### Nouveau fichier `src/components/layer-manager/NcwmsLayerDetails.vue`
Pattern identique à `WmsTimeDetails.vue` et `StacLayerDetails.vue`.

Structure (composants NuxtUI exclusivement) :

```
┌─ Palette ──────────────────────────────────────────┐
│  <USelect v-model="palette" :items="paletteNames"> │
└────────────────────────────────────────────────────┘
┌─ Échelle ──────────────────────────────────────────┐
│  <UToggle v-model="logScale" />  Logarithmique     │
└────────────────────────────────────────────────────┘
┌─ Plage de couleur ──────────────────── [Auto ✨]   ┐
│  Min <UInput type="number">  Max <UInput>          │
│  (USlider ne supporte pas le double range)         │
└────────────────────────────────────────────────────┘
┌─ Légende ──────────────────────────────────────────┐
│  <img :src="legendUrl" v-if="legendUrl" />         │
└────────────────────────────────────────────────────┘
```

- Auto : `UButton` → `autoColorRange(mapStore.currentExtent)` (déjà exposé par le store)
- Légende masquée si URL vide

### Modification `src/components/layer-manager/LayerDetailsPanel.vue`
Même pattern que `WmsTimeDetails` déjà intégré :
```html
<NcwmsLayerDetails v-if="getNcwmsInfo(layer)" :layer="layer" />
```

### Modification `src/components/layer-manager/LayerListItem.vue`
Icône indicatrice (même pattern que l'icône horloge TIME) :
```html
<UIcon v-if="getNcwmsInfo(layer)" name="i-lucide-palette" class="shrink-0 text-gray-400" />
```

---

## Fichiers touchés (résumé)

| Fichier | Action |
|---|---|
| `geospatial-sdk/packages/core/lib/model/map-context.ts` | Ajouter `customParams` à `MapContextLayerWms` |
| `geospatial-sdk/packages/openlayers/lib/map/wms-params.ts` | Spreader `customParams` dans `buildWmsParams()` |
| `src/types/ncwms.types.ts` | Nouveau — type `NcwmsInfo` |
| `src/utils/ncwms.utils.ts` | Nouveau — fetch, buildStyles, buildLegend, `enrichNcwmsLayer` |
| `src/utils/layer.utils.ts` | Ajouter `getNcwmsInfo()` |
| `src/stores/map.store.ts` | Appeler `enrichNcwmsLayer` dans `enrichLayer()` |
| `src/composables/useNcwmsLayer.ts` | Nouveau — palette, logScale, colorScaleRange, auto, legendUrl |
| `src/components/layer-manager/NcwmsLayerDetails.vue` | Nouveau — UI NcWMS |
| `src/components/layer-manager/LayerDetailsPanel.vue` | Intégrer `NcwmsLayerDetails` |
| `src/components/layer-manager/LayerListItem.vue` | Icône indicatrice NcWMS |

**Séparation claire** :
- `style` → `STYLES` (palette de rendu, champ dédié SDK)
- `dimensionValues` → vraies dimensions WMS (`TIME`, `ELEVATION`)
- `customParams` → vendor params NcWMS (`COLORSCALERANGE`, `LOGSCALE`)

---

## Hors scope (suivi)
- ELEVATION (même mécanique que TIME, `dimensionValues.elevation`)
- Transect, profil vertical, série temporelle
- Oceanotron (sous-cas NcWMS avec `multiFeature`)
