import { createRouter, createWebHistory } from 'vue-router'
import MapViewer from '@/components/map/MapViewer.vue'

const router = createRouter({
  // @ts-expect-error
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => MapViewer,
    },
  ],
})

export default router
