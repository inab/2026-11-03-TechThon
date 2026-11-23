# Helm chart for the frontend

For whoever writes the chart that participants install. Keycloak has its own guide: [KEYCLOAK.md](KEYCLOAK.md).

## How it works

- Every participant installs **the same image** with Helm, in their own namespace.
- All of them share **one address**, each under their own path: `https://<host>/annie/`, `https://<host>/bob/`, …
- The Keycloak and host settings are only known on the day, so participants put them in a **values file** when they install ([EVENT_DAY.md](EVENT_DAY.md)).

## The easy way: start from our chart

[`frontend/dev/chart/`](../dev/chart/) already does everything below, and it's tested end to end on a local cluster. Copy it and change only what's different on your cluster:

- **`ingressClassName`** in `values.yaml`, if your cluster doesn't use Traefik
- **TLS** for the host in `templates/ingress.yaml`, if your cluster doesn't add it by itself

The image tag stays `main`: the workshop runs the latest published build.

## What participants run

They fill in this file ([example](../my-values.example.yaml)):

```yaml
path: annie            # their choice
host: <given on the day>
scheme: https
keycloak:
  serverUrl: <given on the day>
  realm: <given on the day>
  clientId: <given on the day>
  clientSecret: <given on the day>
```

and run:

```bash
helm install frontend <chart> -n <namespace> -f my-values.yaml
helm upgrade frontend <chart> -n <namespace> -f my-values.yaml   # after editing, e.g. a new path
helm uninstall frontend -n <namespace>
```

If your chart uses other value names, update the example file and [EVENT_DAY.md](EVENT_DAY.md) to match.

## What the chart has to do

**Run the image:** `ghcr.io/inab/2026-11-03-techthon-frontend:<tag>`. It's public, listens on port **3000**, runs as user 1000, and needs no volumes and about 128 MiB of memory.

**Set these environment variables,** shown for `path: annie`:

| Variable | Value |
|---|---|
| `NUXT_APP_BASE_URL` | `/annie/` |
| `NUXT_SESSION_COOKIE_PATH` | `/annie/` |
| `NUXT_PUBLIC_APP_URL` | `https://<host>/annie/` |
| `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` | `https://<host>/annie/auth/keycloak` |
| `NUXT_OAUTH_KEYCLOAK_SERVER_URL` | `keycloak.serverUrl` |
| `NUXT_OAUTH_KEYCLOAK_REALM` | `keycloak.realm` |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | `keycloak.clientId` |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | `keycloak.clientSecret`, from a Secret the chart creates |
| `NUXT_APP_SECRET` | A random string of 32+ characters, generated once per install |

If one is missing or they don't match, the pod stops at start-up and `kubectl logs` names the variable.

**Route the path with an Ingress:** `<host>`, path `/annie`, `pathType: Prefix`, to the app's Service on port 3000. **Don't rewrite or strip the path**: the app needs to receive `/annie/...` as it is.

**Health check:** `GET /annie/api/health` on port 3000 returns 200. Use it for readiness and liveness.

**Paths must be unique** on the host. Our chart refuses a path that another install already uses. That check needs permission to list Ingresses in all namespaces; if participants won't have it, remove the check at the top of `templates/ingress.yaml`, or `helm install` fails for everyone.

## Two things outside the chart

- **Keycloak must be reachable at the same address** from participants' browsers and from the pods: the browser logs in there, and the app then calls it to finish the login.
- **Optional:** the protected page can show which node a pod runs on. Our chart passes `NODE_NAME` and `NODE_IP` in for that; without them the page just says the node is unknown.

## Check it

Install two participants, for example `annie` and `bob`, then:

1. `https://<host>/annie/` shows the landing page. Logging in goes to Keycloak and back to the protected page.
2. `https://<host>/bob/` still shows **Log in**: each app keeps its own login.
3. Change Annie's path to `perez` in her values file and run `helm upgrade`. `/perez/` works and `/annie/` returns 404.
