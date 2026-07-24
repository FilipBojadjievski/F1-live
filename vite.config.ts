/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/F1-live/', // GitHub Pages project-page subpath (https://filipbojadjievski.github.io/F1-live/)
  plugins: [react()],
  test: {
    globals: true, // required for @testing-library/react auto-cleanup between tests
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
