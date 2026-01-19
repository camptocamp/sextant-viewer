import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
      entry: 'index.html',
      name: 'SxtViewer',
      formats: ['es'],
      fileName: 'sxt-viewer',
    },
    rollupOptions: {
      external: [],
      // output: {
      //   inlineDynamicImports: true,
      // },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
})
