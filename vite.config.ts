import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this as a project site at /flex/, not the domain root.
  base: command === 'build' ? '/flex/' : '/',
  plugins: [react()],
}))
