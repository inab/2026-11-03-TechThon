// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['nuxt-auth-utils', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'TechThon frontend demo',
      // The favicon link is set in app.vue, because it depends on the base path.
    },
  },
  typescript: { strict: true },
  runtimeConfig: {
    public: {
      // Public URL of this app. Override at runtime with NUXT_PUBLIC_APP_URL.
      appUrl: 'http://localhost:3000',
    },
    // The Keycloak settings (runtimeConfig.oauth.keycloak.*) are provided by
    // nuxt-auth-utils and filled from NUXT_OAUTH_KEYCLOAK_* env vars.
    // The session secret is NUXT_APP_SECRET (min. 32 characters).
    session: {
      cookie: {
        // Must equal the base path (NUXT_APP_BASE_URL). When participants share
        // one hostname (/alice/, /bob/), this keeps each app's session cookie
        // to its own path. Override at runtime with NUXT_SESSION_COOKIE_PATH.
        path: '/',
      },
    },
  },
  nitro: { preset: 'node-server' },
})
