import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  // @ts-expect-error issue with vite and meta type
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../components/map/MapViewer.vue'),
    },
  ],
})

export default router
