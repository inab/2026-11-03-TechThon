# Session 2: deploy the app with YAML and publish it with an Ingress

[Index](../WORKSHOP.md) · Previous: [Session 1](01-prerequisites-and-connect.md) · Next: [Session 3: Helm](03-deploy-with-helm.md)

**Goal:** write and apply the basic Kubernetes objects yourself, test the app
from your laptop, then publish it at `https://techbiolab.dev.bsc.es/YOUR_USERNAME/`.

Run the commands from the `kubernetes/` folder, with `KUBECONFIG` set (session 1).

## The app

A small web page with a Keycloak login, from
[inab/2026-11-03-TechThon](https://github.com/inab/2026-11-03-TechThon). It's
one container image, `ghcr.io/inab/2026-11-03-techthon-frontend`, listening on
port 3000. All its settings come from environment variables. It refuses to
start if one is missing, and its log says which.

## The files

In `yaml/`:

| File | Object | What it does |
|---|---|---|
| `01-configmap.yaml` | ConfigMap | Settings: your path and the Keycloak address |
| `02-secret.yaml` | Secret | Secret settings: the Keycloak client secret and a random app secret |
| `03-deployment.yaml` | Deployment | Runs the app (its pods), keeps the number you ask for, replaces failed ones |
| `04-service.yaml` | Service | One stable name and port in front of the pods |
| `05-ingress.yaml` | Ingress | Publishes the Service at a public address and path |

Open each file and read the comments: they explain every part.

## 1. Fill in the files

1. **Your name**, everywhere:

   Replace YOUR_NAME with your username that you provided when signing up

2. **The `REPLACE` values**, from the coordinator:
   - `01-configmap.yaml`: the Keycloak address, realm and client ID
   - `02-secret.yaml`: the client secret, and any random text of 32 or more
     characters for `NUXT_APP_SECRET`, for example from `openssl rand -hex 24`

   The client ID is a name (for example `nuxt-workshop`); the client secret is
   the long random string. Don't swap them.

## 2. Deploy

Check first (the server validates without creating anything), then apply. The
four files go together, so the ConfigMap and Secret exist before the pod needs them:

```bash
kubectl apply --dry-run=server -f yaml/01-configmap.yaml -f yaml/02-secret.yaml -f yaml/03-deployment.yaml -f yaml/04-service.yaml
kubectl apply -f yaml/01-configmap.yaml -f yaml/02-secret.yaml -f yaml/03-deployment.yaml -f yaml/04-service.yaml
```

Watch it start, until `READY 1/1` (about 10 seconds; Ctrl+C to stop watching):

```bash
kubectl get pods -l app=YOUR_USERNAME-web -w
```

Look at what you created:

```bash
kubectl get configmap,secret,deployment,replicaset,pod,service -l app=YOUR_USERNAME-web
kubectl describe pod -l app=YOUR_USERNAME-web     # events at the bottom
kubectl logs deploy/YOUR_USERNAME-web
```



## 3. Publish it with an Ingress

The cluster has one public address, `https://techbiolab.dev.bsc.es`, and each
app gets its own path on it.

The way in: browser → `techbiolab.dev.bsc.es` (the bastion VM, which holds
the HTTPS certificate) → the cluster's ingress controller (nginx) → your
Service → your pods.

```bash
kubectl apply -f yaml/05-ingress.yaml
kubectl get ingress YOUR_USERNAME-web
```

Open `https://techbiolab.dev.bsc.es/YOUR_USERNAME/`. Click **Log in with
Keycloak**, sign in with your Keycloak user, look at the protected page, then
**Log out**. Session 4 explains what happens.

## Changing a setting later

Pods read the ConfigMap and Secret only when they start. After changing them:

```bash
kubectl apply -f yaml/01-configmap.yaml -f yaml/02-secret.yaml
kubectl rollout restart deploy/YOUR_USERNAME-web
```

**Optional:** in `03-deployment.yaml`, change `replicas: 1` to `2`, apply it
again, and run `kubectl get pods -l app=YOUR_USERNAME-web`: two pods now,
maybe on different nodes. Set it back to 1.
