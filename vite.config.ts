import { fileURLToPath, URL } from 'node:url'

import ui from '@nuxt/ui/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

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
    },
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
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
