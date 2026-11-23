// Fails early, with one clear message, when required configuration is missing
// or inconsistent. Never prints secret values.
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const keycloak = config.oauth?.keycloak ?? {}

  const problems: string[] = []
  if (!keycloak.serverUrl) problems.push('NUXT_OAUTH_KEYCLOAK_SERVER_URL is not set')
  if (!keycloak.realm) problems.push('NUXT_OAUTH_KEYCLOAK_REALM is not set')
  if (!keycloak.clientId) problems.push('NUXT_OAUTH_KEYCLOAK_CLIENT_ID is not set')
  if (!keycloak.clientSecret) problems.push('NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET is not set')
  if (typeof config.appSecret !== 'string' || config.appSecret.length < 32) {
    problems.push('NUXT_APP_SECRET is not set or shorter than 32 characters')
  }
  problems.push(...checkUrls(config.app?.baseURL, config.public?.appUrl, keycloak.redirectURL))

  const cookiePath = String(config.session?.cookie?.path || '/')
  const base = String(config.app?.baseURL || '/')
  if (cookiePath !== base) {
    problems.push(
      `NUXT_SESSION_COOKIE_PATH must equal NUXT_APP_BASE_URL ("${base}"), got "${cookiePath}"`,
    )
  }

  if (problems.length === 0) return

  const message = [
    '',
    'Missing or invalid configuration:',
    ...problems.map(problem => `  - ${problem}`),
    'See docs/LOCAL.md (Configuration) for what each variable is.',
    '',
  ].join('\n')

  console.error(message)

  // In dev, keep running so the page still loads. In production, stop loudly.
  if (!import.meta.dev) {
    process.exit(1)
  }
})

// The base path, the public app URL and the Keycloak redirect URL must agree.
// A mismatch only shows up at login time ("Invalid redirect_uri", 404 on the
// callback), so it is checked at start-up instead.
function checkUrls(baseURL: unknown, appUrl: unknown, redirectURL: unknown): string[] {
  const base = String(baseURL || '/')
  if (!base.startsWith('/') || !base.endsWith('/')) {
    return [`NUXT_APP_BASE_URL must start and end with "/" (for example "/alice/"), got "${base}"`]
  }

  let app: URL
  try {
    app = new URL(String(appUrl))
  }
  catch {
    return [`NUXT_PUBLIC_APP_URL is not a valid URL, got "${String(appUrl)}"`]
  }

  const problems: string[] = []
  const appPath = `${app.pathname.replace(/\/+$/, '')}/`
  if (appPath !== base) {
    problems.push(
      `NUXT_PUBLIC_APP_URL must end with the base path "${base}" (NUXT_APP_BASE_URL), got "${app.href}"`,
    )
  }

  const expectedRedirect = `${app.origin}${base}auth/keycloak`
  if (redirectURL && redirectURL !== expectedRedirect) {
    problems.push(
      `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL must be "${expectedRedirect}", got "${String(redirectURL)}"`,
    )
  }
  return problems
}
