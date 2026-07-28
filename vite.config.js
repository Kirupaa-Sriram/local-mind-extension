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
    rollupOptions: {
      // Entry points go here, NOT directly under `build`. `build.input`
      // isn't a real Vite option, so it was being silently ignored — that's
      // why offscreen.html never showed up in the build output list.
      input: {
        offscreen: resolve(__dirname, 'offscreen.html'),
      },
    },
  },
})
