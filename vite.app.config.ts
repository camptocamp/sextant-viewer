import webComponentConfig from './vite.config'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  ...webComponentConfig,
  base: './', // base href should always be relative to where the app is
  build: {
    outDir: 'dist/app',
    rollupOptions: {
      input: 'index.html',
    },
  },
})
