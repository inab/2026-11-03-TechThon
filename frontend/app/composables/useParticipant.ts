/**
 * Who this deployment belongs to, read from the base path at runtime
 * (NUXT_APP_BASE_URL). Every participant runs the same image, so this is the
 * only thing that tells the apps apart.
 *
 *   base "/anni/" -> { path: "anni", base: "/anni/" }
 *   base "/"      -> { path: null, ... }   (local development)
 */
export function useParticipant() {
  const base = useRuntimeConfig().app.baseURL || '/'
  const path = base.replace(/^\/+|\/+$/g, '')

  return {
    path: path || null,
    base,
  }
}
