# Session 4: Keycloak and OIDC, protecting the application

[Index](../WORKSHOP.md) · Previous: [Session 3](03-deploy-with-helm.md)

**Goal:** understand how the login works, where its settings live, and what
breaks when one is wrong.

## The pieces

- **Keycloak** is the login service. Apps don't check passwords themselves:
  they send users to Keycloak.
- A **realm** is one separate set of users and apps in Keycloak. Ours is
  given by the coordinator (for example `workshop`).
- A **client** is an app registered in the realm (for example
  `nuxt-workshop`). It has an ID, a **secret** and a list of addresses
  Keycloak may send users back to (`https://techbiolab.dev.bsc.es/*`).
- **OIDC** (OpenID Connect) is the standard way the app and Keycloak talk.

All participants share one client: the `*` in its allowed addresses covers
everyone's path.

## What happens when you click Log in

1. The app sends your browser to Keycloak, with its client ID and its return
   address, `https://techbiolab.dev.bsc.es/YOUR_USERNAME/auth/keycloak`.
2. You sign in at Keycloak. Keycloak sends the browser back to that address
   with a one-time **code**.
3. The app exchanges the code for your **tokens**, calling Keycloak directly
   and proving who it is with the client secret. The browser never sees the
   secret.
4. The app keeps your login in a session cookie, limited to `/YOUR_USERNAME/`,
   and shows the protected page.

Log out ends the session at Keycloak too, which is why Keycloak asks "Do you
want to log out?".

## Where the settings are

| Setting | YAML (session 2) | Helm (session 3) |
|---|---|---|
| Keycloak address | `NUXT_OAUTH_KEYCLOAK_SERVER_URL` in the ConfigMap | `keycloak.serverUrl` |
| Realm | `NUXT_OAUTH_KEYCLOAK_REALM` | `keycloak.realm` |
| Client ID | `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | `keycloak.clientId` |
| Client secret | `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` in the Secret | `keycloak.clientSecret` (the chart puts it in a Secret) |
| Return address | `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` | built from `path` |

Keycloak describes itself at a fixed address. Look at it:

```bash
curl -s <Keycloak address>/realms/<realm>/.well-known/openid-configuration
```

`issuer` is the realm's public address; `authorization_endpoint` is where
browsers log in; `token_endpoint` is where the app exchanges the code.

## Try it

With the Helm install from session 3. After each change, run
`helm upgrade YOUR_USERNAME ./chart -f my-values.yaml`, try to log in, then
put the right value back.

1. **Wrong client secret:** change one character of `clientSecret`. Keycloak
   accepts your password, but the login fails when you come back to the app:
   the app couldn't prove who it is.
2. **Wrong client ID:** set `clientId: nobody`. Keycloak says "Client not
   found" straight away.
3. **Separate logins:** log in to your app, then open a neighbour's address.
   Keycloak may skip the password (you're already logged in there), but each
   app keeps its own session cookie.
4. **Private window:** open your app in a private window. You have to log in
   again: no cookies there.

## If something goes wrong

| On screen | What to do |
|---|---|
| Keycloak: `Client not found` | The client ID is wrong. It's a name like `nuxt-workshop`, not the secret. |
| Keycloak: `Invalid parameter: redirect_uri` | The address you opened doesn't match the app's settings (path or `https`). |
| The app says the login failed, right after Keycloak | Usually a wrong client secret. |
| Keycloak: `Invalid username or password` | Check the user and password from the coordinator. |
| Logging in skips the password | Normal if you're already logged in to Keycloak in this browser. |
