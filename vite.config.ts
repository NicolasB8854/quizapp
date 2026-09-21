/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Chunk-Warngrenze auf 300 kB senken — nach dem Split-Refactor sollten
    // einzelne Chunks deutlich kleiner sein. Wenn wir wieder darüber landen,
    // ist das ein Signal zum Nachdenken.
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: {
          // React + Router in einen eigenen Vendor-Chunk. Selten geändert,
          // langfristig gecacht.
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'packages/shared/src/**/*.test.ts',
    ],
    globals: false,
    // Reset localStorage/session-state zwischen Tests, damit questionHistory
    // sich nicht durch die Testreihen zieht.
    clearMocks: true,
    restoreMocks: true,
  },
})
