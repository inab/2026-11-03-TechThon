/**
 * Prefixes a path with the app's base path (NUXT_APP_BASE_URL, e.g. "/alice/").
 *
 * Use it for plain <a href> links to server routes such as /auth/keycloak.
 * NuxtLink, navigateTo and useFetch already add the base path themselves.
 *
 *   appPath('/auth/keycloak')  ->  '/auth/keycloak'          (base "/")
 *                              ->  '/alice/auth/keycloak'    (base "/alice/")
 */
export function appPath(path: string): string {
  const base = useRuntimeConfig().app.baseURL.replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}
