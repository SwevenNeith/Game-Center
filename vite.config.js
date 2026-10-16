import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: '/Game-Center/',
  define: mode === 'test' ? {} : { global: 'globalThis' },
  optimizeDeps: {
    include: ['buffer', '@pkmn/sim'],
  },
  worker: {
    format: 'es',
  },
}))