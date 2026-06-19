---
outline: deep
---

# Introduction

`<sxt-viewer>` est un web component qui encapsule une carte OpenLayers. Il s'intègre dans n'importe quelle page HTML sans framework.

## Installation

### Via CDN

```html
<script type="module" src="https://cdn.jsdelivr.net/.../@camptocamp/sextant-viewer/dist/sxt-viewer.js"></script>
```

### Via npm

```bash
npm install @camptocamp/sextant-viewer
```

```js
import '@camptocamp/sextant-viewer'
```

## Exemple minimal

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="sxt-viewer.js"></script>
    <style>
      sxt-viewer { display: block; width: 100%; height: 500px; }
    </style>
  </head>
  <body>
    <sxt-viewer id="viewer"></sxt-viewer>

    <script type="module">
      const viewer = document.getElementById('viewer')

      viewer.setInitialContext({
        backgroundLayers: [
          {
            type: 'xyz',
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            label: 'OpenStreetMap',
            attributions: '© OpenStreetMap contributors',
            visibility: true,
            opacity: 1,
          },
        ],
        layers: [],
        view: {
          center: [-4.56243, 48.36143],
          zoom: 12,
        },
      })
    </script>
  </body>
</html>
```

## Architecture

Le composant est construit avec Vue 3 et OpenLayers, distribué en un fichier JS autonome (shadow DOM). L'API publique est entièrement basée sur des appels de méthodes JavaScript — il n'y a pas d'attributs HTML à configurer.

## Étapes suivantes

- [Contexte de carte](/guides/context) — comprendre `ExtendedMapContext` et ses méthodes
- [Couches](/guides/layers) — catalogue des types de couches supportés
- [Événements](/guides/events) — écouter les changements de carte
