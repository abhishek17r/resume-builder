import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Importers are loaded on demand; pre-bundle them at startup so the first import
  // doesn't trigger a dependency re-optimisation (and a page reload) mid-session.
  optimizeDeps: { include: ['pdfjs-dist', 'mammoth', 'jszip'] },
})
