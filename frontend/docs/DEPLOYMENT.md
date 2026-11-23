# Deployment guide: Helm chart

For whoever writes the Helm chart. It covers what the image expects, the settings for each participant, and how to check that it all works. Keycloak is set up following [KEYCLOAK.md](KEYCLOAK.md). Participants follow [EVENT_DAY.md](EVENT_DAY.md).

## The model

- **One image for everyone.** Nothing environment-specific is inside it. All configuration comes from environment variables at start-up.
- **One Helm release per participant**, installed by the participant.
- **One shared hostname, one path per participant.** The participant chooses the path and can change it later (see [Changing a participant's path](#changing-a-participants-path)).

```
https://workshop.example.com/anni/   ─┐                ┌─► Service ─► Pod (NUXT_APP_BASE_URL=/anni/)
https://workshop.example.com/bob/    ─┼─► Ingress ─────┼─► Service ─► Pod (NUXT_APP_BASE_URL=/bob/)
https://workshop.example.com/carol/  ─┘                └─► ...
```

- **One shared Keycloak client** for all participants.

The app runs the login flow itself (landing page → Keycloak login → protected page → logout), so a working login shows that the deployment works end to end.

## The image

| | |
|---|---|
| Image | `ghcr.io/<owner>/workshop-frontend:<tag>`, public, so no image pull secret is needed |
| Port | `3000` (HTTP) |
| User | Non-root, uid `1000`, gid `1000` (`runAsNonRoot: true` works) |
| Volumes | None. The app keeps no files and no state on disk |
| Memory | About 100 MiB in use when idle. A request of 128Mi and a limit of 256Mi is a reasonable start |
| Start-up | About 1–2 s |
| Version | Build arguments `APP_VERSION` and `APP_BUILD_TIME`, set by the CI; shown on the protected page. Without them it shows `dev` |

## Environment variables

### Shared by all participants (chart values)

| Variable | Example | Notes |
|---|---|---|
| `NUXT_OAUTH_KEYCLOAK_SERVER_URL` | `https://keycloak.example.com` | Must be reachable from the pods **and** from participants' browsers, at the same URL |
| `NUXT_OAUTH_KEYCLOAK_REALM` | `workshop` | |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | `nuxt-workshop` | |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | | **Secret.** A Kubernetes Secret created by you in **each participant namespace** (Secrets can't be shared across namespaces); participants never see its value |

### For each participant (all derived from one value: the path)

For path `anni` on `https://workshop.example.com`:

| Variable | Value | Notes |
|---|---|---|
| `NUXT_APP_BASE_URL` | `/anni/` | Leading **and** trailing slash |
| `NUXT_SESSION_COOKIE_PATH` | `/anni/` | Same value as `NUXT_APP_BASE_URL`. Keeps each participant's login cookie to their own path |
| `NUXT_PUBLIC_APP_URL` | `https://workshop.example.com/anni/` | Hostname + base path |
| `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` | `https://workshop.example.com/anni/auth/keycloak` | App URL + `auth/keycloak` |
| `NUXT_APP_SECRET` | random, 32+ characters | **Secret.** Signs the session cookie. Generate it per release (e.g. Helm `randAlphaNum 48`). If it changes on upgrade, the participant just has to log in again |

### Checked at start-up

The container checks these rules when it starts. If one fails, it **exits with code 1** and prints the variables at fault, without their values:

- All the variables above are set, and `NUXT_APP_SECRET` is at least 32 characters.
- `NUXT_APP_BASE_URL` starts and ends with `/`.
- `NUXT_PUBLIC_APP_URL` ends with the base path.
- `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` equals `NUXT_PUBLIC_APP_URL` + `auth/keycloak`.
- `NUXT_SESSION_COOKIE_PATH` equals `NUXT_APP_BASE_URL`.

A pod in `CrashLoopBackOff` usually means one of these. `kubectl logs` shows which one, for example:

```
Missing or invalid configuration:
  - NUXT_SESSION_COOKIE_PATH must equal NUXT_APP_BASE_URL ("/anni/"), got "/"
```

## What the chart should offer participants

Participants should only have to give **one value, the path**. The chart derives the four per-participant variables and the Ingress rule from it. The participant docs ([EVENT_DAY.md](EVENT_DAY.md)) assume these commands; if your chart uses other names, update that document.

```bash
helm install <release> <chart> --set path=anni                     # deploy
helm upgrade <release> <chart> --reuse-values --set path=perez     # change the path
helm uninstall <release>                                           # remove
```

- **Keep the path separate from the release name**, so a participant can change the path without reinstalling.
- **Validate the path** in the chart, e.g. `^[a-z0-9-]+$`, so it's safe in a URL and in resource names.
- **Each path must be unique** on the host. Two releases with the same path would fight over the same Ingress rule.

## Changing a participant's path

The path is not fixed. It's only runtime configuration, so a participant can start as `anni` and switch to `perez`, as often as they like:

```bash
helm upgrade <release> <chart> --reuse-values --set path=perez
```

What happens:
- The pod restarts with the new settings, and the Ingress rule moves to `/perez`. The image is not rebuilt or pulled again.
- `https://<host>/anni/` stops working and `https://<host>/perez/` takes over.
- The participant logs in again on the new path, because the old login cookie belonged to `/anni/`.
- Keycloak needs no change: `https://<host>/*` covers every path.

A participant who wants two paths at once installs a second release with a different path.

## Ingress

- Route path prefix `/<path>` (`pathType: Prefix`) to the participant's Service, port 3000.
- **Do not strip or rewrite the prefix.** The app expects `/<path>/...` in the request path. A rewrite such as `nginx.ingress.kubernetes.io/rewrite-target: /` breaks it.
- `https://<host>/anni` (no trailing slash) also works.
- Pass the original `Host` header and `X-Forwarded-Proto` (Traefik and ingress-nginx do both by default).
- Terminate TLS at the Ingress. The app speaks plain HTTP inside the cluster.

## Health probes

`GET /<path>/api/health` on port 3000, for example `/anni/api/health`. It returns `200 {"status":"ok"}`, needs no login and makes no external calls. Use it for both readiness and liveness. The image itself has no Docker healthcheck.

## What the protected page shows

After login, the protected page shows how the request reached the app, layer by layer: Ingress host and path, the node the pod runs on, namespace, pod name and IP, image version, and the Keycloak session.

- **Node name and IP (optional):** pass them in with the Downward API. Without these two variables, the page says the node isn't provided by the chart.

  ```yaml
  env:
    - name: NODE_NAME
      valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
    - name: NODE_IP
      valueFrom: { fieldRef: { fieldPath: status.hostIP } }
  ```

- **Namespace and Kubernetes version** come from the pod's service account files. They show `unknown` if the chart sets `automountServiceAccountToken: false`. The version is read once from the API's `/version` endpoint, which every service account may read by default, so **no extra permissions are needed**.

## Reference manifests for one participant

A starting point for the chart templates, shown for path `anni`. Everything with `anni` in it comes from the path value; everything marked `<...>` is a shared value.

```yaml
# Created by you in each participant namespace, before participants install
# (not part of the release):
#   kubectl create secret generic workshop-keycloak \
#     --from-literal=client-secret='<client secret>'
---
apiVersion: v1
kind: Secret
metadata:
  name: frontend-<release>
type: Opaque
stringData:
  app-secret: "<random, 32+ characters>"   # e.g. {{ randAlphaNum 48 }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-<release>
  labels: { app: frontend, release: <release> }
spec:
  replicas: 1
  selector:
    matchLabels: { app: frontend, release: <release> }
  template:
    metadata:
      labels: { app: frontend, release: <release> }
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: frontend
          image: ghcr.io/<owner>/workshop-frontend:<tag>
          ports:
            - containerPort: 3000
          env:
            - { name: NUXT_OAUTH_KEYCLOAK_SERVER_URL, value: "<https://keycloak.example.com>" }
            - { name: NUXT_OAUTH_KEYCLOAK_REALM,      value: "<workshop>" }
            - { name: NUXT_OAUTH_KEYCLOAK_CLIENT_ID,  value: "<nuxt-workshop>" }
            - name: NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET
              valueFrom: { secretKeyRef: { name: workshop-keycloak, key: client-secret } }
            - name: NUXT_APP_SECRET
              valueFrom: { secretKeyRef: { name: frontend-<release>, key: app-secret } }
            - { name: NUXT_APP_BASE_URL,                value: "/anni/" }
            - { name: NUXT_SESSION_COOKIE_PATH,         value: "/anni/" }
            - { name: NUXT_PUBLIC_APP_URL,              value: "https://<workshop.example.com>/anni/" }
            - { name: NUXT_OAUTH_KEYCLOAK_REDIRECT_URL, value: "https://<workshop.example.com>/anni/auth/keycloak" }
          readinessProbe:
            httpGet: { path: /anni/api/health, port: 3000 }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /anni/api/health, port: 3000 }
            periodSeconds: 10
          resources:
            requests: { memory: 128Mi, cpu: 50m }
            limits:   { memory: 256Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-<release>
spec:
  selector: { app: frontend, release: <release> }
  ports:
    - port: 3000
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend-<release>
  # No rewrite-target annotation: the /anni prefix must reach the app.
spec:
  ingressClassName: <nginx>
  tls:
    - hosts: [<workshop.example.com>]
      secretName: <tls-secret>
  rules:
    - host: <workshop.example.com>
      http:
        paths:
          - path: /anni
            pathType: Prefix
            backend:
              service:
                name: frontend-<release>
                port: { number: 3000 }
```

Resource names use the release name, not the path, so changing the path only changes environment variables and the Ingress path. One Ingress per release is fine: Ingress controllers merge rules for the same host (tested with Traefik).

## Keycloak

Keycloak is set up separately, following [KEYCLOAK.md](KEYCLOAK.md). From it you get the four shared values above (URL, realm, client ID, client secret). Two things concern the cluster:

- The pods must reach Keycloak at the **same URL** the browsers use. The app exchanges the login code with Keycloak server-side.
- The Keycloak client must allow `https://<host>/*`, with the same host as the Ingress. Then no Keycloak change is needed per participant or per path change.

## A working example chart

`frontend/dev/chart/` in this repository is a small chart that implements everything above: one `path` value, the four derived variables, a per-release session secret kept across upgrades, probes, an Ingress without rewrite, path validation, and a check that refuses a path another release already uses. It runs on a local kind cluster (`frontend/dev/kind/cluster.sh`, see [LOCAL.md](LOCAL.md#rehearse-the-event-day-on-kubernetes)), where the whole flow, including a path change with `helm upgrade`, was tested in a browser. Use it as a starting point or a reference; the defaults in its `values.yaml` are for the local cluster.

## Checking a deployment

With two participants deployed (say paths `anni` and `bob`), in one browser window:

1. `https://<host>/anni/` loads the landing page; `https://<host>/anni/protected` sends you back to `/anni/`.
2. **Log in** on `/anni/` goes to Keycloak and back to `/anni/protected`, showing the user's name and email.
3. `https://<host>/bob/` still shows **Log in**: Anni's login does not leak to Bob's app.
4. **Log in** on `/bob/` works **without a password prompt**. That's expected: the browser already has a Keycloak session.
5. **Log out** on `/anni/`: Keycloak asks "Do you want to log out?", you click **Logout**, and you land back on `/anni/`. Bob's app keeps its own session.
6. **Change the path:** run `helm upgrade <anni's release> <chart> --reuse-values --set path=perez`. `/perez/` now works and asks you to log in, and `/anni/` returns 404.

From a terminal: `curl https://<host>/anni/api/health` returns `{"status":"ok"}`, and `curl -i https://<host>/anni/api/stack` returns `401`.
