interface AccessTokenClaims {
  exp?: number
  realm_access?: { roles?: string[] }
}

/**
 * Reads the claims of a JWT without verifying it. Only for display: the token
 * comes straight from Keycloak's token endpoint over a server-side call.
 */
export function readJwtClaims(token: unknown): AccessTokenClaims {
  try {
    const payload = String(token).split('.')[1] ?? ''
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  }
  catch {
    return {}
  }
}
