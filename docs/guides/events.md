---
outline: deep
---

# Événements

Le composant émet des événements via le mécanisme standard `CustomEvent`. Le payload est dans `event.detail`.

## `map-extent-change`

Émis à chaque déplacement ou zoom de la carte.

**Payload :** `Extent` — tableau `[minX, minY, maxX, maxY]` en **EPSG:4326**.

```js
const viewer = document.getElementById('viewer')

viewer.addEventListener('map-extent-change', (event) => {
  const [minX, minY, maxX, maxY] = event.detail
  console.log('Nouvelle emprise :', event.detail)
})
```

::: tip Coordonnées
L'emprise est toujours en WGS84 (EPSG:4326), quel que soit le système de projection de la carte.
:::

::: warning Fréquence d'émission
Cet événement est émis en continu lors du déplacement. Utilisez un mécanisme de debounce si vous avez besoin de déclencher des appels réseau :

```js
let timeout
viewer.addEventListener('map-extent-change', (event) => {
  clearTimeout(timeout)
  timeout = setTimeout(() => fetchData(event.detail), 300)
})
```
:::
