# Deployment guide: Helm chart

For whoever writes the Helm chart. It covers what the image expects, the settings for each participant, and how to check that it all works. Keycloak is set up following [KEYCLOAK.md](KEYCLOAK.md). Participants follow [EVENT_DAY.md](EVENT_DAY.md).

## The model

- **One image for everyone.** Nothing environment-specific is inside it. All configuration comes from environment variables at start-up.
- **One Helm release per participant**, installed by the participant.
- **One shared hostname, one path per participant.** The participant chooses the path and can change it later (see [Changing a participant's path](#changing-a-participants-path)).

```
https://workshop.example.com/annie/   ─┐                ┌─► Service ─► Pod (NUXT_APP_BASE_URL=/annie/)
https://workshop.example.com/bob/    ─┼─► Ingress ─────┼─► Service ─► Pod (NUXT_APP_BASE_URL=/bob/)
https://workshop.example.com/carol/  ─┘                └─► ...
```

- **One shared Keycloak client** for all participants.

The app runs the login flow itself (landing page → Keycloak login → protected page → logout), so a working login shows that the deployment works end to end.

## The image

| | |
|---|---|
| Image | `ghcr.io/inab/2026-11-03-techthon-frontend:<tag>`, public, so no image pull secret is needed. Use a version tag such as `1.0.0` (see the tags in [LOCAL.md](LOCAL.md#publishing-the-image)) |
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
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | | **Secret.** Given out on the day and entered by each participant in their values file; the chart stores it in a Secret per release (see below) |

### For each participant (all derived from one value: the path)

For path `annie` on `https://workshop.example.com`:

| Variable | Value | Notes |
|---|---|---|
| `NUXT_APP_BASE_URL` | `/annie/` | Leading **and** trailing slash |
| `NUXT_SESSION_COOKIE_PATH` | `/annie/` | Same value as `NUXT_APP_BASE_URL`. Keeps each participant's login cookie to their own path |
| `NUXT_PUBLIC_APP_URL` | `https://workshop.example.com/annie/` | Hostname + base path |
| `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` | `https://workshop.example.com/annie/auth/keycloak` | App URL + `auth/keycloak` |
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
  - NUXT_SESSION_COOKIE_PATH must equal NUXT_APP_BASE_URL ("/annie/"), got "/"
```

## What the chart should offer participants

The Keycloak and host settings are only known on the event day, so **participants enter them at install time** in a values file. The repository has the example they start from, [`frontend/my-values.example.yaml`](../my-values.example.yaml):

```yaml
path: annie            # the participant's choice
host: <given on the day>
scheme: https
keycloak:
  serverUrl: <given on the day>
  realm: <given on the day>
  clientId: <given on the day>
  clientSecret: <given on the day>
```

The participant docs ([EVENT_DAY.md](EVENT_DAY.md)) assume these value names and commands; if your chart uses other names, update the example file and that document.

```bash
helm install <release> <chart> -f my-values.yaml      # deploy
helm upgrade <release> <chart> -f my-values.yaml      # after editing the file, e.g. a new path
helm uninstall <release>                              # remove
```

- **Derive everything from these values:** the four per-participant variables and the Ingress rule come from `path`, `host` and `scheme`.
- **Store `keycloak.clientSecret` in a Secret** created by the chart, and restart the pod when it changes (a checksum annotation on the pod template).
- **Keep the path separate from the release name**, so a participant can change the path without reinstalling.
- **Validate the path** in the chart, e.g. `^[a-z0-9-]+$`, so it's safe in a URL and in resource names.
- **Each path must be unique** on the host. Two releases with the same path would fight over the same Ingress rule.

[`frontend/dev/chart/`](../dev/chart/) does all of this and can serve as the starting point.

## Changing a participant's path

The path is not fixed. It's only runtime configuration, so a participant can start as `annie` and switch to `perez`, as often as they like:

They change `path` in their values file and run:

```bash
helm upgrade <release> <chart> -f my-values.yaml
```

What happens:
- The pod restarts with the new settings, and the Ingress rule moves to `/perez`. The image is not rebuilt or pulled again.
- `https://<host>/annie/` stops working and `https://<host>/perez/` takes over.
- The participant logs in again on the new path, because the old login cookie belonged to `/annie/`.
- Keycloak needs no change: `https://<host>/*` covers every path.

A participant who wants two paths at once installs a second release with a different path.

## Ingress

- Route path prefix `/<path>` (`pathType: Prefix`) to the participant's Service, port 3000.
- **Do not strip or rewrite the prefix.** The app expects `/<path>/...` in the request path. A rewrite such as `nginx.ingress.kubernetes.io/rewrite-target: /` breaks it.
- `https://<host>/annie` (no trailing slash) also works.
- Pass the original `Host` header and `X-Forwarded-Proto` (Traefik and ingress-nginx do both by default).
- Terminate TLS at the Ingress. The app speaks plain HTTP inside the cluster.

## Health probes

`GET /<path>/api/health` on port 3000, for example `/annie/api/health`. It returns `200 {"status":"ok"}`, needs no login and makes no external calls. Use it for both readiness and liveness. The image itself has no Docker healthcheck.

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

A starting point for the chart templates, shown for path `annie`. Everything with `annie` in it comes from `path`; everything marked `<...>` comes from the other values in the participant's file.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: frontend-<release>
type: Opaque
stringData:
  app-secret: "<random, 32+ characters>"   # e.g. {{ randAlphaNum 48 }}
  client-secret: "<keycloak.clientSecret>"  # from the participant's values file
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
          image: ghcr.io/inab/2026-11-03-techthon-frontend:<tag>
          ports:
            - containerPort: 3000
          env:
            - { name: NUXT_OAUTH_KEYCLOAK_SERVER_URL, value: "<https://keycloak.example.com>" }
            - { name: NUXT_OAUTH_KEYCLOAK_REALM,      value: "<workshop>" }
            - { name: NUXT_OAUTH_KEYCLOAK_CLIENT_ID,  value: "<nuxt-workshop>" }
            - name: NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET
              valueFrom: { secretKeyRef: { name: frontend-<release>, key: client-secret } }
            - name: NUXT_APP_SECRET
              valueFrom: { secretKeyRef: { name: frontend-<release>, key: app-secret } }
            - { name: NUXT_APP_BASE_URL,                value: "/annie/" }
            - { name: NUXT_SESSION_COOKIE_PATH,         value: "/annie/" }
            - { name: NUXT_PUBLIC_APP_URL,              value: "https://<workshop.example.com>/annie/" }
            - { name: NUXT_OAUTH_KEYCLOAK_REDIRECT_URL, value: "https://<workshop.example.com>/annie/auth/keycloak" }
          readinessProbe:
            httpGet: { path: /annie/api/health, port: 3000 }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /annie/api/health, port: 3000 }
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
  # No rewrite-target annotation: the /annie prefix must reach the app.
spec:
  ingressClassName: <nginx>
  tls:
    - hosts: [<workshop.example.com>]
      secretName: <tls-secret>
  rules:
    - host: <workshop.example.com>
      http:
        paths:
          - path: /annie
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

With two participants deployed (say paths `annie` and `bob`), in one browser window:

1. `https://<host>/annie/` loads the landing page; `https://<host>/annie/protected` sends you back to `/annie/`.
2. **Log in** on `/annie/` goes to Keycloak and back to `/annie/protected`, showing the user's name and email.
3. `https://<host>/bob/` still shows **Log in**: Annie's login does not leak to Bob's app.
4. **Log in** on `/bob/` works **without a password prompt**. That's expected: the browser already has a Keycloak session.
5. **Log out** on `/annie/`: Keycloak asks "Do you want to log out?", you click **Logout**, and you land back on `/annie/`. Bob's app keeps its own session.
6. **Change the path:** set `path: perez` in Annie's values file and run `helm upgrade <release> <chart> -f my-values.yaml`. `/perez/` now works and asks you to log in, and `/annie/` returns 404.

From a terminal: `curl https://<host>/annie/api/health` returns `{"status":"ok"}`, and `curl -i https://<host>/annie/api/stack` returns `401`.
