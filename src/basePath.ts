// Single source of truth for the deploy subpath. Vite's `base` (see vite.config.ts) is exposed
// to the app as import.meta.env.BASE_URL with a trailing slash; React Router's basename wants it
// without one, so both consume this to stay in sync under GitHub Pages' /F1-live/ subpath.
export function routerBasename(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}
