import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const SPA_ROUTES = ['starter-aveugle']

function githubPagesSpaFallback() {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const index = resolve(outDir, 'index.html')
      copyFileSync(index, resolve(outDir, '404.html'))
      for (const route of SPA_ROUTES) {
        const dir = resolve(outDir, route)
        mkdirSync(dir, { recursive: true })
        copyFileSync(index, resolve(dir, 'index.html'))
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), githubPagesSpaFallback()],
  base: '/Game-Center/',
  appType: 'spa',
  define: mode === 'test' ? {} : { global: 'globalThis' },
  optimizeDeps: {
    include: ['buffer', '@pkmn/sim'],
  },
  worker: {
    format: 'es',
  },
}))
