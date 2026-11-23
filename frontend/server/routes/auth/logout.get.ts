// Ends the app session AND the Keycloak SSO session, then returns to the app.
export default defineEventHandler(async (event) => {
  await clearUserSession(event)

  const config = useRuntimeConfig(event)
  const { serverUrl, realm, clientId } = config.oauth.keycloak
  const appUrl = String(config.public.appUrl).replace(/\/+$/, '')

  const params = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: `${appUrl}/`,
  })

  return sendRedirect(
    event,
    `${serverUrl}/realms/${realm}/protocol/openid-connect/logout?${params}`,
  )
})
