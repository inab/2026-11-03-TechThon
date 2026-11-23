# Keycloak for the frontend

For whoever runs Keycloak for the workshop. The Helm chart has its own guide: [DEPLOYMENT.md](DEPLOYMENT.md).

## What's needed

One realm, one client and the participants' users. Every participant's app lives at `https://<host>/<their path>/`, and they all log in through the same client. You don't add anything per participant.

The app was tested with Keycloak 26.4.

## 1. The server

- **One address for everyone:** participants' browsers and the app's pods must reach Keycloak at the **same** address, e.g. `https://keycloak.example.com`. The browser logs in there, and the app then calls it to finish the login.
- **HTTPS**, with `KC_HOSTNAME` set to that address.

## 2. Realm and client

1. In the admin console: **Create realm** → **Resource file** → pick [`frontend/keycloak/realm-export.json`](../keycloak/realm-export.json) → **Create**. This creates the realm `workshop`, the client `nuxt-workshop` and a test user `demo`.
2. **New client secret** (the one in the file is public): **Clients → nuxt-workshop → Credentials → Regenerate**. Note it down.
3. **Allowed addresses:** in **Clients → nuxt-workshop → Settings**, replace the `localhost` entries:
   - **Valid redirect URIs:** `https://<host>/*`
   - **Valid post logout redirect URIs:** `https://<host>/*`
   - **Web origins:** `https://<host>`
   - **Root URL** and **Home URL:** empty

   `<host>` is the workshop address, e.g. `workshop.example.com`. The `*` covers every participant's path.
4. **Require HTTPS:** **Realm settings → General → Require SSL → External requests.**

## 3. Users

Delete `demo` and add the workshop users (**Users → Add user**). For each one:
- fill in username, email, first and last name, and turn on **Email verified**;
- under **Credentials**, set a password with **Temporary: Off**.

Otherwise Keycloak stops participants at their first login to complete their profile or change the password.

## 4. Check it

```bash
curl https://keycloak.example.com/realms/workshop/.well-known/openid-configuration
```

The `issuer` in the answer must be your public address: `https://keycloak.example.com/realms/workshop`.

## 5. Hand over

Give the event coordinator:
- **For participants' values files:** the Keycloak address, the realm (`workshop`), the client ID (`nuxt-workshop`) and the client secret
- **The usernames and passwords**

After the workshop, regenerate the client secret and remove the users.

## If something goes wrong

| On screen | Fix |
|---|---|
| `Invalid parameter: redirect_uri` | The address the participant opened isn't covered by **Valid redirect URIs**. Check the host, including `https://`. |
| The app says the login failed, right after Keycloak | The client secret in the participant's values file doesn't match Keycloak's, or the pods can't reach Keycloak. |
| Keycloak asks to update the profile or the password | Fill in the user's name and email, and make the password non-temporary. |
| "Do you want to log out?" | Normal. Click **Logout**. |
