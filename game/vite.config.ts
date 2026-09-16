import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.mimosa/**', '**/.v2c/**', '**/.video_agent/**'] }
  },
  build: { target: 'es2020' }
})
