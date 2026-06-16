import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/doorbell-app/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['leaflet', 'leaflet.markercluster'],
  },
})
