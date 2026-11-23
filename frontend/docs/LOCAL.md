# Local development

Run the app on your own machine, and rehearse the event day on a local Kubernetes cluster. Both use a local Keycloak.

## Run the app from source (development)

Runs the source code directly with `pnpm dev`: no Docker image, no Kubernetes. Use it while working on the app; changes show up in the browser right away. For the Kubernetes rehearsal you only need step 1 (Keycloak).

Needs Node 22, pnpm and Docker (Docker only for the local Keycloak). Run everything from the `frontend` folder (`cd frontend`).

**1. Start the local Keycloak** (realm `workshop`, user `demo` / `demo`) and wait until it's ready:

```bash
docker compose -f docker-compose.dev.yml up -d keycloak
bash scripts/wait-for-keycloak.sh
```

**2. Create `.env`** with the local Keycloak values and a session secret:

```bash
cp local.env.example .env
sed -i "s|^NUXT_APP_SECRET=.*|NUXT_APP_SECRET=$(openssl rand -base64 32)|" .env
```

**3. Run the app:**

```bash
pnpm install
pnpm dev
```

Open **http://localhost:3000/anni/** and log in with **demo / demo**. The app runs under the path `/anni/`, like on the event day (see the "Event day" section in `.env`). On logout, Keycloak asks "Do you want to log out?": click **Logout**.

Good to know:
- **Use `localhost`, not `127.0.0.1`.** The Keycloak client only accepts `localhost` URLs. `pnpm dev` listens on IPv4 and IPv6, so `localhost` works whichever one your browser picks. This also makes it reachable from your local network.
- **Run at the root instead** (http://localhost:3000/): in `.env`, comment out the four lines in the "Event day" section, uncomment the four in "Local", and restart `pnpm dev`.
- **Keycloak admin console:** http://localhost:8080 (`admin` / `admin`).
- **Other scripts:** `pnpm build`, `pnpm typecheck`, `pnpm lint`.
- **Stop Keycloak:** `docker compose -f docker-compose.dev.yml down`. It re-imports the realm from `keycloak/realm-export.json` on the next start, so changes made in the admin console are lost.

## Rehearse the event day on Kubernetes

This runs the event-day flow on your machine: you publish the image to a registry, then install it with Helm on a Kubernetes cluster, as a participant would. Locally:

| On the day | Here |
|---|---|
| Shared cluster, Ingress at `https://<host>/` | [kind](https://kind.sigs.k8s.io/) cluster `workshop`, Traefik at `http://localhost/` |
| Image on `ghcr.io` | Registry container at `localhost:5001` |
| Shared Keycloak | Your local Keycloak, as `http://keycloak.localhost:8080` (the same name works from the browser and from the pods) |
| The coworker's chart | `dev/chart/`, a stand-in that follows [DEPLOYMENT.md](DEPLOYMENT.md) |
| One namespace per participant | `participant-1` and `participant-2` |

Needs Docker on Linux (native Docker Engine; Docker Desktop isn't tested), [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation), [kubectl](https://kubernetes.io/docs/tasks/tools/) and [Helm](https://helm.sh/docs/intro/install/), about 3 GB of free disk space, and port 80 free. Run everything from the `frontend` folder (`cd frontend`).

**1. Start the local Keycloak** (step 1 of [Run the app from source](#run-the-app-from-source-development)), if it isn't running. You don't need `.env` or `pnpm dev` here.

**2. Create the cluster** (a few minutes the first time):

```bash
bash dev/kind/cluster.sh up
```

**3. Publish the image** to the local registry, as the CI will do to `ghcr.io`:

```bash
docker build -t localhost:5001/workshop-frontend:dev .
docker push localhost:5001/workshop-frontend:dev
```

**4. Deploy as a participant**, like in [EVENT_DAY.md](EVENT_DAY.md). Kubernetes pulls the image from the registry:

```bash
helm install frontend dev/chart -n participant-1 --set path=anni
kubectl get pods -n participant-1        # wait for READY 1/1
```

Open **http://localhost/anni/** and log in with `demo` / `demo`.

**5. Try the rest:**

```bash
# A second participant
helm install frontend dev/chart -n participant-2 --set path=bob

# Change the path: http://localhost/perez/ works, /anni/ returns 404
helm upgrade frontend dev/chart -n participant-1 --reuse-values --set path=perez

# A path someone else has is refused
helm install other dev/chart -n participant-2 --set path=perez

# Remove a deployment
helm uninstall frontend -n participant-2
```

After changing the app, repeat step 3 and restart the pods to pull the new image: `kubectl rollout restart deployment frontend -n participant-1`.

**Remove everything** (the local Keycloak keeps running):

```bash
bash dev/kind/cluster.sh down
```

## Configuration

Everything environment-specific is an environment variable; nothing is baked into the image. The app checks the values at start-up. In production it **exits with a message naming each wrong or missing variable** (never their values).

| Variable | Meaning | Local value (`local.env.example`) |
|---|---|---|
| `NUXT_OAUTH_KEYCLOAK_SERVER_URL` | Keycloak base URL | `http://localhost:8080` |
| `NUXT_OAUTH_KEYCLOAK_REALM` | Realm | `workshop` |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | Client ID | `nuxt-workshop` |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | Client secret (confidential client) | dev-only value |
| `NUXT_APP_SECRET` | Signs the session cookie. At least 32 characters: `openssl rand -base64 32` | (you generate it) |
| `NUXT_PUBLIC_APP_URL` | The app's public URL, **including** the path | `http://localhost:3000` |
| `NUXT_OAUTH_KEYCLOAK_REDIRECT_URL` | `NUXT_PUBLIC_APP_URL` + `auth/keycloak` | `http://localhost:3000/auth/keycloak` |
| `NUXT_APP_BASE_URL` | Path the app runs under, e.g. `/anni/` | `/` |
| `NUXT_SESSION_COOKIE_PATH` | Must equal `NUXT_APP_BASE_URL` | `/` |

The last four must agree with each other. For path `anni` on `https://workshop.example.com` they are:

```dotenv
NUXT_APP_BASE_URL=/anni/
NUXT_SESSION_COOKIE_PATH=/anni/
NUXT_PUBLIC_APP_URL=https://workshop.example.com/anni/
NUXT_OAUTH_KEYCLOAK_REDIRECT_URL=https://workshop.example.com/anni/auth/keycloak
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "`appSecret` is not set" | `NUXT_APP_SECRET` is empty in `.env`. Run the `sed` line from step 2, then restart. |
| Pod stays `0/1` or shows `CrashLoopBackOff` | A missing or inconsistent variable: `kubectl logs -n participant-1 deploy/frontend` names it. |
| `ErrImagePull` / `ImagePullBackOff` | The image isn't in the local registry: repeat step 3 of the rehearsal. |
| `cluster.sh up` fails on port 80 | Another program uses port 80. Stop it, then run `bash dev/kind/cluster.sh down` and `up` again. |
| Keycloak shows `Invalid parameter: redirect_uri` | You opened the app on `127.0.0.1` instead of `localhost`, or the URL is not allowed on the Keycloak client. |
| `Invalid client credentials` after login | Wrong client secret. |
| `wait-for-keycloak.sh` times out | Keycloak failed to start: `docker compose -f docker-compose.dev.yml logs keycloak`. |
| Port 3000 already in use | `pnpm dev` is already running in another terminal. |

## Publishing the image

GitHub Actions builds the image for `linux/amd64` and `linux/arm64` and publishes it as **`ghcr.io/inab/2026-11-03-techthon-frontend`** (workflow: `.github/workflows/frontend-image.yml` at the repository root).

| When | Tags |
|---|---|
| A push to `main` that changes `frontend/` | `main`, `sha-<commit>` |
| A version tag, e.g. `git tag v1.0.0 && git push origin v1.0.0` | `1.0.0`, `1.0`, `latest` |
| A pull request | Built to check it works; nothing is published |

Use a version tag for the event, so the cluster runs a fixed image.
