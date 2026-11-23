# Event day: deploy your frontend

You deploy the workshop frontend to the shared Kubernetes cluster with Helm. It gets its own address, `https://<host>/<your-path>/`, and you log in to it with Keycloak.

## What you need

Install these before the workshop:
- `kubectl` and `helm`
- Chrome or Firefox

You get these from the coordinator on the day:
- **A kubeconfig file** (cluster access) and your **namespace**
- **The chart** (a name or a link)
- **The host**, for example `workshop.example.com`
- **A Keycloak user and password**

Check your cluster access:

```bash
export KUBECONFIG=<path to the kubeconfig file>
kubectl get pods -n <your namespace>
```

"No resources found" means it works.

## 1. Choose your path

Your path is the last part of your app's address. Use lowercase letters, numbers and dashes only, for example `annie` or `perez`. It must be unique among all participants. You can change it later.

## 2. Deploy

```bash
helm install frontend <chart> -n <your namespace> --set path=annie
```

`frontend` is the name of your release. Keep it: you need it to change or remove the deployment.

Wait until the pod is ready (about 10 seconds):

```bash
kubectl get pods -n <your namespace>
```

The `READY` column shows `1/1` when it's done.

## 3. Try it

Open `https://<host>/annie/`, using your path:

1. The landing page is public.
2. Click **Log in** and sign in with your Keycloak user.
3. You land on the protected page, showing your name and email.
4. Click **Log out**. Keycloak asks "Do you want to log out?": click **Logout**, and you're back on the landing page.

## Change your path

For example, from `annie` to `perez`:

```bash
helm upgrade frontend <chart> -n <your namespace> --reuse-values --set path=perez
```

After a few seconds your app is at `https://<host>/perez/`, and the old address stops working. Log in again on the new address.

## Remove your deployment

```bash
helm uninstall frontend -n <your namespace>
```

## If something goes wrong

| Symptom | What to do |
|---|---|
| `READY` stays `0/1`, or `STATUS` shows `CrashLoopBackOff` | Run `kubectl logs -n <your namespace> <pod name>`, using the pod name from `kubectl get pods`. The first lines name the problem. Show them to the coordinator. |
| `404` on your address | Check that the path in the address is the one you deployed: `helm get values frontend -n <your namespace>`. |
| Someone else's app shows up, or yours doesn't | Another participant may have the same path. Change yours (see above). |
| Keycloak says `Invalid username or password` | Check the user and password from the coordinator. |
| Logging in skips the password prompt | Normal if you're already logged in to Keycloak in this browser (for example on another path). |
| `Unauthorized` / `forbidden` from `kubectl` or `helm` | `KUBECONFIG` is not set in this terminal, or you forgot `-n <your namespace>`. |
