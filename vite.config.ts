import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import { fileURLToPath, URL } from 'node:url'

// Set USE_LINKED_PACKAGES=1 when developing against locally-linked copies of
// @camptocamp/ogc-client and @geospatial-sdk/* (via `npm link`). This forces all
// imports (including transitive ones, e.g. ogc-client pulled in by
// @geospatial-sdk/openlayers) to resolve to the single linked copy, so local
// patches are picked up and Vite does not pre-bundle a stale/duplicate version.
const useLinkedPackages = process.env.USE_LINKED_PACKAGES === '1'

const linkedAliases: Record<string, string> = useLinkedPackages
  ? {
      '@camptocamp/ogc-client': fileURLToPath(
        new URL('./node_modules/@camptocamp/ogc-client/dist/dist-node.js', import.meta.url),
      ),
      '@geospatial-sdk/core': fileURLToPath(
        new URL('./node_modules/@geospatial-sdk/core/dist/index.js', import.meta.url),
      ),
      '@geospatial-sdk/legend': fileURLToPath(
        new URL('./node_modules/@geospatial-sdk/legend/dist/index.js', import.meta.url),
      ),
      '@geospatial-sdk/openlayers': fileURLToPath(
        new URL('./node_modules/@geospatial-sdk/openlayers/dist/index.js', import.meta.url),
      ),
    }
  : {}

const linkedExclude = useLinkedPackages
  ? [
      '@camptocamp/ogc-client',
      '@geospatial-sdk/core',
      '@geospatial-sdk/legend',
      '@geospatial-sdk/openlayers',
    ]
  : []

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      features: {
        // this is to make sure that all component styles are embedded in the final JS; otherwise we end up with a separate CSS file
        customElement: true,
      },
    }),
    ui({
      router: false,
      colorMode: false,
      ui: {
        tabs: {
          defaultVariants: {
            color: 'neutral',
            variant: 'link',
          },
        },
        colors: {
          primary: 'blue', // TODO: define a color scale that matches Sextant theme better
        },
      },
    }),
    tailwindcss(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...linkedAliases,
    },
    dedupe: [
      '@camptocamp/ogc-client',
      '@geospatial-sdk/core',
      '@geospatial-sdk/legend',
      '@geospatial-sdk/openlayers',
      'ol',
    ],
  },
  build: {
    lib: {
      entry: 'src/register.ts',
      formats: ['es'],
      fileName: 'sxt-viewer',
    },
    rollupOptions: {
      input: ['demo/index.html'],
      external: [],
      output: {
        // this is useful for dynamic imports coming from dependencies
        inlineDynamicImports: true,
      },
    },
  },
  optimizeDeps: {
    // When using linked packages, exclude them from the dep optimizer so Vite serves
    // the aliased dist files directly and always reflects local source changes.
    exclude: linkedExclude,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
