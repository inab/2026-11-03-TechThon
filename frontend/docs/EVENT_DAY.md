# Event day: deploy your frontend

You deploy the workshop frontend to the shared Kubernetes cluster with Helm. It gets its own address, `https://<host>/<your-path>/`, and you log in to it with Keycloak.

## What you need

Install these before the workshop:
- `kubectl` and `helm`
- Chrome or Firefox

You get these from the coordinator on the day:
- **A kubeconfig file** (cluster access) and your **namespace**
- **The chart** (a name or a link)
- **The settings for your values file:** the workshop address (host), Keycloak's address, the realm, the client ID and the client secret
- **A Keycloak user and password**

Check your cluster access:

```bash
export KUBECONFIG=<path to the kubeconfig file>
kubectl get pods -n <your namespace>
```

"No resources found" means it works.

## 1. Create your values file

Download the example and copy it:

```bash
curl -O https://raw.githubusercontent.com/inab/2026-11-03-TechThon/main/frontend/my-values.example.yaml
cp my-values.example.yaml my-values.yaml
```

Open `my-values.yaml` and fill it in:
- **`path`:** your choice, the last part of your app's address. Lowercase letters, numbers and dashes only, for example `annie` or `perez`. It must be unique among all participants. You can change it later.
- **`scheme`:** `https`.
- **Every other value:** replace it with what the coordinator gives you.

The file contains the client secret: don't share it.

## 2. Deploy

```bash
helm install frontend <chart> -n <your namespace> -f my-values.yaml
```

`frontend` is the name of your release. Keep it: you need it to change or remove the deployment.

Wait until the pod is ready (about 10 seconds):

```bash
kubectl get pods -n <your namespace>
```

The `READY` column shows `1/1` when it's done.

## 3. Try it

Open `https://<host>/<your path>/`, for example `https://<host>/annie/`:

1. The landing page is public and shows your name, taken from your path.
2. Click **Log in with Keycloak** and sign in with your Keycloak user.
3. You land on the protected page. It shows the layers your request went through; click one to see its details, such as your pod's name.
4. Click **Log out**. Keycloak asks "Do you want to log out?": click **Logout**, and you're back on the landing page.

## Change your path

Change `path` in `my-values.yaml`, for example from `annie` to `perez`, then:

```bash
helm upgrade frontend <chart> -n <your namespace> -f my-values.yaml
```

After a few seconds your app is at `https://<host>/perez/`, and the old address stops working. Log in again on the new address.

If you got a value wrong, fix it in `my-values.yaml` and run the same command.

## Remove your deployment

```bash
helm uninstall frontend -n <your namespace>
```

## If something goes wrong

| Symptom | What to do |
|---|---|
| `helm` says `path "..." is not valid` | Use only lowercase letters, numbers and dashes in `path`. |
| `helm` says `path "..." is already taken` | Another participant has that path. Choose another one. |
| `READY` stays `0/1`, or `STATUS` shows `CrashLoopBackOff` | Run `kubectl logs -n <your namespace> <pod name>`, using the pod name from `kubectl get pods`. The first lines name the setting that's wrong. Fix it in `my-values.yaml` and run `helm upgrade` (see above). |
| `404` on your address | Check that the path in the address is the one you deployed: `helm get values frontend -n <your namespace>`. |
| Keycloak shows `Invalid parameter: redirect_uri` | `host` or `scheme` in `my-values.yaml` doesn't match the address you opened. |
| The app says the login failed, right after Keycloak | Usually a wrong `clientSecret`. Check it in `my-values.yaml`. |
| Keycloak says `Invalid username or password` | Check the user and password from the coordinator. |
| Logging in skips the password prompt | Normal if you're already logged in to Keycloak in this browser (for example on another path). |
| `Unauthorized` / `forbidden` from `kubectl` or `helm` | `KUBECONFIG` is not set in this terminal, or you forgot `-n <your namespace>`. |
