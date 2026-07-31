import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {crx} from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'
import {resolve} from 'path'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    hmr:{
      port: 5173
    },
  },
  build:{
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'offscreen.html'),
      },
    },
  },
})
