# Sextant Viewer

The Sextant Viewer is a map viewer built with several important architecture decisions:
* distributed as a Web Component with a full API for efficient integration in any web application
* support for cloud-optimized and global/environmental datasets
* the ability to use either OpenLayers for 2D rendering or MapLibre for a globe view 

Funded by Ifremer and the Sextant project:

[![Logo Ifremer](ifremer_logo.png)](https://www.ifremer.fr/fr) [![Logo Sextant](sextant_logo.png)](https://sextant.ifremer.fr/)

Web Component demo: https://sextant.gitlab-pages.ifremer.fr/viewer/

App demo: https://sextant.gitlab-pages.ifremer.fr/viewer/app/

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

Main `index.html` page is a standard app, useful for development with hot-reload.

Web Component demo page is available at: http://localhost:5173/demo/index.html

Note: once demo page has been opened, hot-reload does not work anymore in the standard app.

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

Note that standard app is not built and therefore not available in preview.

Only the Web Component demo page is available in preview: http://localhost:4173/demo/index.html

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
