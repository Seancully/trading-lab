import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites, base is `/<repo>/`. Override at build
// time with VITE_BASE_PATH if you fork or rename the repo.
const base = process.env.VITE_BASE_PATH ?? '/trading-lab/'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? base : '/',
  server: { host: true },
}))
