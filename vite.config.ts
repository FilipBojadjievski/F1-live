/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // required for @testing-library/react auto-cleanup between tests
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
