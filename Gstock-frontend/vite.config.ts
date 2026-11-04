import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Application installable et utilisable sans réseau (ADR-005, phase F9).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // L'enregistrement est fait dans main.tsx (ou par MSW avec les données simulées).
      injectRegister: false,
      injectManifest: {
        // Script classique : il peut charger le worker de MSW avec importScripts.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        // Le lecteur de codes-barres (zxing, environ 1 Mo) doit marcher sans réseau.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globIgnores: ['mockServiceWorker.js'],
      },
      manifest: {
        name: 'GStock — Stock, caisse et crédits',
        short_name: 'GStock',
        description: 'Vendre, suivre le stock et les crédits clients de votre boutique, même sans réseau.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF8EC',
        theme_color: '#2B2A8C',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Vendre', short_name: 'Vendre', url: '/vendre', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
