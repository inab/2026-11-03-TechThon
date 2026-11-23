# Keycloak setup for the workshop

For whoever runs the shared Keycloak server. It covers what the workshop frontend needs from Keycloak, step by step, and what to hand over afterwards. The Helm chart side is in [DEPLOYMENT.md](DEPLOYMENT.md).

## What the app needs

Every participant deploys the same frontend to `https://<host>/<their path>/` (for example `https://workshop.example.com/annie/`). All of them log in through **one realm and one client**:

- a realm (here `workshop`)
- a **confidential** OpenID Connect client (here `nuxt-workshop`) using the standard login flow (authorization code)
- users to log in with

Participants choose their own path and can change it on the day, so the client must accept **any path on the workshop host**. A single wildcard entry does that; you don't add anything per participant.

The app was tested against Keycloak 26.4.

## 1. The server

- **Same URL for browsers and pods.** Participants' browsers are sent to Keycloak to log in, and the frontend pods call Keycloak directly to finish the login. Both must reach it at the **same** URL, e.g. `https://keycloak.example.com`.
- **HTTPS**, with `KC_HOSTNAME` set to that public URL, so the tokens carry the issuer the app expects.
- **No path prefix.** The app expects Keycloak's default paths (`https://keycloak.example.com/realms/workshop/...`), not `.../auth/realms/...`.

## 2. Create the realm and client

The quickest way is to import the file from this repository, then adjust it.

1. Admin console → realm dropdown → **Create realm** → **Resource file**: pick `frontend/keycloak/realm-export.json` → **Create**.

   This creates the realm `workshop`, the client `nuxt-workshop` and a test user `demo`. The file is set up for local development, so the next steps are required.

2. **Regenerate the client secret.** The one in the file (`dev-only-secret-do-not-use-elsewhere`) is public.
   **Clients → nuxt-workshop → Credentials → Client secret → Regenerate.** Copy the new value for the handover (step 5).

3. **Set the client URLs.** **Clients → nuxt-workshop → Settings**:

   | Setting | Value |
   |---|---|
   | Root URL | empty |
   | Home URL | empty |
   | Valid redirect URIs | `https://<host>/*` |
   | Valid post logout redirect URIs | `https://<host>/*` |
   | Web origins | `https://<host>` |

   Replace `<host>` with the workshop hostname, e.g. `workshop.example.com`. Remove the `http://localhost:3000` entries from the file. Click **Save**.

   Leave **Home URL** empty: Keycloak shows it as a "Back to application" link on some of its pages, and no single address fits, since every participant has their own path.

   Keycloak accepts a `*` only at the end of a URI, which is exactly what's needed here: `https://<host>/*` covers `/annie/auth/keycloak`, `/perez/auth/keycloak` and any other path.

4. **Require HTTPS.** **Realm settings → General → Require SSL**: set it to **External requests** (or **All requests**). The file sets **None**, which is only for local HTTP.

<details>
<summary>Creating the client by hand instead of importing</summary>

**Clients → Create client**:
- Client type **OpenID Connect**, Client ID `nuxt-workshop`
- **Client authentication: On** (confidential client)
- Authentication flow: **Standard flow** only. Direct access grants, Implicit flow, Service accounts and OAuth 2.0 Device Authorization Grant off
- Then the URLs from step 3, and copy the secret from the **Credentials** tab

</details>

## 3. Users

Delete the `demo` user, then create the workshop users (**Users → Add user**), either one per participant or one shared account. For each user:

- **Username**, **Email**, **First name**, **Last name** all filled in, and **Email verified** on. Otherwise Keycloak asks participants to complete their profile when they first log in.
- **Credentials → Set password**, with **Temporary: Off**. Otherwise Keycloak asks for a new password on first login.

The frontend shows the user's name and email after login, so use values you're happy to see on screen.

## 4. Check it

Before handing over, check the realm answers at the public URL:

```bash
curl https://keycloak.example.com/realms/workshop/.well-known/openid-configuration
```

It should return JSON whose `issuer` is `https://keycloak.example.com/realms/workshop`, with your public hostname, not an internal one.

Once a frontend is deployed, log in on it with one of the users: [DEPLOYMENT.md](DEPLOYMENT.md#checking-a-deployment) has the full check.

## 5. Hand over

Give the Helm chart owner these four values. They are the same for every participant:

| Value | Example | Becomes |
|---|---|---|
| Keycloak URL | `https://keycloak.example.com` | `NUXT_OAUTH_KEYCLOAK_SERVER_URL` |
| Realm | `workshop` | `NUXT_OAUTH_KEYCLOAK_REALM` |
| Client ID | `nuxt-workshop` | `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` |
| Client secret | (from step 2) | `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` |

The client secret is the only secret one: share it privately. Participants never see it; the chart owner stores it in a Kubernetes Secret in each participant namespace.

Give the event coordinator the **usernames and passwords** for the participants.

## On the day

| Symptom | Cause |
|---|---|
| Keycloak page: `Invalid parameter: redirect_uri` | The participant's address isn't covered by **Valid redirect URIs**. Check that the host matches exactly, including `https://`. |
| Keycloak page: `Invalid redirect uri` after clicking **Log out** | Same, for **Valid post logout redirect URIs**. |
| The app shows a login error right after the Keycloak login | Usually the client secret in the cluster doesn't match the one in Keycloak, or the pods can't reach the Keycloak URL. |
| Keycloak asks to update the profile or the password | The user is missing a name or email, or the password is temporary (see step 3). |
| "Do you want to log out?" page on logout | Normal. Participants click **Logout**. |
| Login doesn't ask for a password | Normal if the browser is already logged in to Keycloak, for example from another participant's path. |

## After the workshop

Regenerate the client secret (so the one shared with the cluster stops working), and delete the workshop users or disable the realm.
