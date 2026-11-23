declare module '#auth-utils' {
  interface User {
    id: string
    username?: string
    name?: string
    email?: string
  }

  interface UserSession {
    loggedInAt?: number
    keycloak?: {
      roles: string[]
      tokenExpiresAt: number | null
    }
  }
}

export {}
