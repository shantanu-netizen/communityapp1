import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle MUI so dependency optimization stays stable (avoids "Outdated Optimize Dep" after edits).
  optimizeDeps: {
    include: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
  },
})
