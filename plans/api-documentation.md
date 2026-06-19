# Plan : Documentation API du Web Component

## Contexte

Le projet `sextant-viewer` expose un web component `<sxt-viewer>` avec une API publique amenée à grandir (props, CSS vars, etc.). L'objectif est un site de documentation statique publiable, avec l'API générée automatiquement depuis la source unique (`SxtViewer.ce.vue`).

**Stack retenu :**
- **VitePress** ~1.6.4 — générateur de site statique (identique à geospatial-sdk)
- **Script custom `@vue/compiler-sfc`** — extrait l'API du composant depuis le SFC, génère un Markdown
- **TypeDoc** ~0.28.16 + plugins — documente les types complexes (`MapContextLayer`, `ExtendedMapContext`, etc.)

> CEM (`@custom-elements-manifest/analyzer`) a été évalué et **éliminé** : aucun plugin mature pour Vue 3 `<script setup>` + `defineExpose`.

---

## Architecture de génération

```
SxtViewer.ce.vue  ──────────────────────────────────────────►  scripts/generate-api-docs.mjs
  defineProps (futur)                                                       │
  defineEmits                                                               │
  defineExpose                                                              │
  /* @cssproperty ... */ (futur)                                            │
                                                                           ▼
src/types/{map,stac,layer.utils}.ts  ──►  TypeDoc  ──►  docs/api/types/
                                                                           │
                                                                           ▼
                                                            docs/.vitepress/dist/  (HTML publiable)
                                                                via VitePress build
```

---

## Structure à créer

```
docs/
├── package.json                    # workspace "sextant-viewer-docs"
├── typedoc.json                    # types uniquement (pas SxtViewer)
├── .vitepress/
│   ├── config.mts                  # nav + sidebar
│   └── theme/
│       ├── index.ts
│       └── style.css
├── index.md                        # page d'accueil
├── guides/
│   ├── introduction.md
│   ├── context.md
│   ├── layers.md
│   └── events.md
└── api/
    ├── index.md                    # overview (committé)
    ├── SxtViewerElement.md         # généré par le script custom
    └── types/                      # généré par TypeDoc (gitignored)

scripts/
└── generate-api-docs.mjs           # script de génération depuis SxtViewer.ce.vue
```

---

## Fichiers à créer / modifier

### Nouveau : `scripts/generate-api-docs.mjs`

Script Node.js utilisant `@vue/compiler-sfc` (déjà dans `node_modules`) et le compilateur TypeScript (déjà dans `devDependencies`) pour parser `SxtViewer.ce.vue` et générer `docs/api/SxtViewerElement.md`.

**Ce qu'il extrait :**

| Source dans le SFC | Extraction | Section Markdown |
|--------------------|-----------|-----------------|
| JSDoc sur fonctions dans `defineExpose` | Nom, signature, `@param`, `@returns` | Methods |
| `defineProps<T>()` + JSDoc (futur) | Nom, type, description | Props / Attributes |
| `defineEmits<{ ... }>()` + JSDoc | Nom, type payload, description | Events |
| Commentaires `/* @cssproperty ... */` dans `<style>` (futur) | Nom, type, défaut | CSS Custom Properties |

**Format JSDoc attendu dans `SxtViewer.ce.vue` :**

```typescript
/**
 * Ajoute une couche au-dessus de la pile de couches actuelle.
 * @param layer - Définition de la couche (tous types MapContextLayer + stac)
 * @param zoomToExtent - Si true, ajuste la vue sur l'emprise de la couche
 */
async function addLayer(layer: MapContextLayer, zoomToExtent = false) { ... }
```

**Ce que le script génère (`docs/api/SxtViewerElement.md`) :**

```markdown
---
aside: false
---
# SxtViewerElement

L'élément `<sxt-viewer>` est un web component...

## Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `addLayer` | `(layer, zoomToExtent?) → Promise<void>` | ... |

## Events
| Event | Payload | Description |
|-------|---------|-------------|
| `map-extent-change` | `Extent` | ... |

## Props  (section vide jusqu'à ajout de defineProps)

## CSS Custom Properties  (section vide jusqu'à ajout de @cssproperty)
```

### Nouveau : `docs/package.json`

```json
{
  "name": "sextant-viewer-docs",
  "private": true,
  "scripts": {
    "predocs:dev": "node ../scripts/generate-api-docs.mjs && typedoc",
    "docs:dev": "vitepress dev",
    "predocs:build": "node ../scripts/generate-api-docs.mjs && typedoc",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "typedoc": "~0.28.16",
    "typedoc-plugin-frontmatter": "~1.3.1",
    "typedoc-plugin-markdown": "~4.9.0",
    "typedoc-vitepress-theme": "~1.1.2",
    "vitepress": "~1.6.4"
  }
}
```

### Nouveau : `docs/typedoc.json`

Entry point limité aux types réutilisables (pas l'interface de l'élément) :

```json
{
  "entryPoints": [
    "../src/types/map.types.ts",
    "../src/types/stac.types.ts"
  ],
  "tsconfig": "../tsconfig.app.json",
  "plugin": ["typedoc-plugin-markdown", "typedoc-vitepress-theme", "typedoc-plugin-frontmatter"],
  "out": "./api/types",
  "readme": "none",
  "indexFormat": "table",
  "parametersFormat": "table",
  "interfacePropertiesFormat": "table",
  "typeAliasPropertiesFormat": "table",
  "hideBreadcrumbs": true,
  "frontmatterGlobals": { "aside": false }
}
```

> **Note :** `MapContextLayer`, `MapContextView`, `Extent` viennent de `@geospatial-sdk/core` et seront cross-linkés dans le guide Couches. Pas besoin de les re-documenter ici.

### Nouveau : `docs/.vitepress/config.mts`

Même structure que geospatial-sdk : nav `Home / Guides / API`, sidebar avec guides + API générée.

### Modifiés

| Fichier | Modification |
|---------|-------------|
| `package.json` | `"workspaces": ["docs"]` + scripts `docs:dev/build/preview` |
| `src/components/SxtViewer.ce.vue` | Ajouter JSDoc complet sur les 5 fonctions exposées |
| `.gitignore` | `docs/api/SxtViewerElement.md`, `docs/api/types/` (sauf `docs/api/index.md`) |

### CI (optionnel, à faire séparément)

- **`.gitlab-ci.yml`** + **`.github/workflows/gh-pages.yml`** : ajouter un step "Build docs" → `npm run docs:build --workspace docs`, copier `docs/.vitepress/dist/` vers `public/docs/`

---

## Guide pages — contenu

| Page | Contenu |
|------|---------|
| `index.md` | Hero VitePress, liens Guides / API / Demo |
| `guides/introduction.md` | Installation CDN/npm, example HTML minimal |
| `guides/context.md` | `ExtendedMapContext`, `setInitialContext` vs `setContext` |
| `guides/layers.md` | Catalogue 9 types de couches avec exemples |
| `guides/events.md` | `map-extent-change`, `CustomEvent`, EPSG:4326 |
| `api/index.md` | Overview de l'API, lien vers `SxtViewerElement` |

---

## Ordre d'implémentation

1. Ajouter JSDoc sur les 5 méthodes de `SxtViewer.ce.vue`
2. Créer `scripts/generate-api-docs.mjs` + vérifier la génération de `docs/api/SxtViewerElement.md`
3. Créer `docs/package.json`, `docs/typedoc.json`
4. Ajouter `"workspaces": ["docs"]` + scripts dans le `package.json` racine
5. `npm install` depuis la racine
6. Créer `docs/.vitepress/config.mts` + thème
7. Écrire les 5 pages guides + `docs/api/index.md`
8. Mettre à jour `.gitignore`
9. Vérifier `npm run docs:build` end-to-end

---

## Vérification

1. `npm run docs:build` réussit (TypeDoc + script + VitePress)
2. La page `SxtViewerElement` liste les 5 méthodes avec leurs signatures et descriptions
3. L'ajout d'un `defineProps` dans le SFC + JSDoc → apparaît automatiquement dans la page générée
4. `docs/api/SxtViewerElement.md` est bien gitignored
5. Le site HTML est dans `docs/.vitepress/dist/` et publiable tel quel
