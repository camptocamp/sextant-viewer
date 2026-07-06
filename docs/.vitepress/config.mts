import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Sextant Viewer',
  description: 'Documentation du web component <sxt-viewer>',
  vite: {
    server: {
      proxy: {
        '/demo': 'http://localhost:5173',
      },
    },
  },
  themeConfig: {
    nav: [
      { text: 'Accueil', link: '/' },
      { text: 'Guides', link: '/guides/introduction' },
      { text: 'API', link: '/api/' },
      { text: 'Démo', link: '/demo/', target: '_self' },
    ],

    sidebar: [
      {
        text: 'Guides',
        items: [
          { text: 'Introduction', link: '/guides/introduction' },
          { text: 'Contexte de carte', link: '/guides/context' },
          { text: 'Couches', link: '/guides/layers' },
          { text: 'Événements', link: '/guides/events' },
        ],
      },
      {
        text: 'Référence API',
        link: '/api/',
        items: [
          { text: 'SxtViewerElement', link: '/api/SxtViewerElement' },
          { text: 'Types', link: '/api/types' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/camptocamp/sextant-viewer' },
    ],

    search: {
      provider: 'local',
    },
  },
})
