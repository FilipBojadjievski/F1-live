import { expect, it } from 'vitest'
import { routerBasename } from './basePath'

// Vite's import.meta.env.BASE_URL always carries a trailing slash ('/F1-live/', '/').
// React Router's basename wants no trailing slash, except the site root which stays '/'.
it('strips the trailing slash from a subpath base', () => {
  expect(routerBasename('/F1-live/')).toBe('/F1-live')
})

it('keeps the root base as a single slash', () => {
  expect(routerBasename('/')).toBe('/')
})

it('is idempotent when the base already lacks a trailing slash', () => {
  expect(routerBasename('/F1-live')).toBe('/F1-live')
})
