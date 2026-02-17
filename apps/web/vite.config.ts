import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  // define: { global: 'window' }  <-- REMOVED: potentially unsafe replacement
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    alias: {
      'react-native': path.resolve(__dirname, './src/react-native-shim.js'),
      '@docstruc/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@docstruc/logic': path.resolve(__dirname, '../../packages/logic/src/index.ts'),
      '@docstruc/api': path.resolve(__dirname, '../../packages/api/src/index.ts'),
      '@docstruc/hooks': path.resolve(__dirname, '../../packages/hooks/src/index.ts'),
      '@docstruc/theme': path.resolve(__dirname, '../../packages/theme/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/query-sync-storage-persister'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
