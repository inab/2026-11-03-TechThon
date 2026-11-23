/**
 * The app's base path (NUXT_APP_BASE_URL), always with a leading and trailing
 * slash: "/" by default, "/alice/" when each participant runs under a sub-path.
 */
export function basePath(): string {
  const raw = String(useRuntimeConfig().app?.baseURL || '/')
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
}

/** Prefixes a server-side redirect target with the base path. */
export function withBasePath(path: string): string {
  return basePath() + path.replace(/^\/+/, '')
}
