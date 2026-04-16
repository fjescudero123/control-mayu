import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'firebase'],
    alias: {
      '@mayu/hooks': fileURLToPath(new URL('./src/hooks/shared/index.ts', import.meta.url))
    }
  }
})
