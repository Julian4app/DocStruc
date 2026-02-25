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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Supabase
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // React Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // React Native Web (large)
          if (id.includes('node_modules/react-native') || id.includes('node_modules/@react-native')) {
            return 'vendor-rn-web';
          }
          // Lottie animations
          if (id.includes('node_modules/lottie-react') || id.includes('node_modules/lottie-web')) {
            return 'vendor-lottie';
          }
          // PDF generation (very large — only loaded on reports page)
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          // ExcelJS (large — only loaded on reports page)
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/jszip') || id.includes('node_modules/archiver')) {
            return 'vendor-xlsx';
          }
        },
      },
    },
  },
})
