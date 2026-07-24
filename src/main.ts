import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { clearCache, setCacheExpiryDuration } from '@camptocamp/ogc-client'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'

// Disable the ogc-client session cache when requested (see VITE_DISABLE_OGC_CACHE in
// vite.config.ts) so changes to a locally linked ogc-client are always picked up.
if (import.meta.env.VITE_DISABLE_OGC_CACHE) {
  setCacheExpiryDuration(0)
  clearCache()
}

const app = createApp(App)

app.use(createPinia())
app.use(ui)

app.mount('#app')
