import { sendRedirect } from 'nuxt/server'

// Handles both steps of the OAuth flow:
//   1. no ?code  -> redirects the browser to Keycloak
//   2. ?code=... -> exchanges the code, reads the user, creates the session
export default defineOAuthKeycloakEventHandler({
  async onSuccess(event, { user, tokens }) {
    // Only keep what the demo needs. Tokens are NOT stored (cookie size limit),
    // just two facts read from the access token for the stack view.
    const claims = readJwtClaims(tokens.access_token)
    await setUserSession(event, {
      user: {
        id: user.sub,
        username: user.preferred_username,
        name: user.name,
        email: user.email,
      },
      loggedInAt: Date.now(),
      keycloak: {
        roles: claims.realm_access?.roles ?? [],
        tokenExpiresAt: claims.exp ? claims.exp * 1000 : null,
      },
    })
    return sendRedirect(event, withBasePath('/protected'))
  },
  onError(event, error) {
    console.error('[auth] Keycloak login failed:', error.message)
    return sendRedirect(event, withBasePath('/?error=auth'))
  },
})
