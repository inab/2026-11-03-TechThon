# Session 3: deploy the same app with Helm

[Index](../WORKSHOP.md) · Previous: [Session 2](02-deploy-with-yaml.md) · Next: [Session 4: Keycloak and OIDC](04-keycloak-oidc.md)

**Goal:** install the same app from a Helm chart, change it with one settings
file, and see Helm's history and rollback.

## Why Helm

In session 2 you edited five files, and your path alone appears in multiple
places. A Helm **chart** is a set of templates for those objects. You give it
a short **values** file, and Helm fills the templates in, creates the objects,
and remembers each install as a numbered **revision**.

The chart is in `chart/`: `values.yaml` holds the defaults, `templates/` the
objects. Have a look.

## 1. Remove the YAML version

Both versions would use the same path, so remove the first one:

```bash
kubectl delete -f yaml/
```

## 2. Your values file

```bash
cp my-values.example.yaml my-values.yaml
```

Edit `my-values.yaml`: `path: YOUR_USERNAME` and the four Keycloak values
(the same as in session 2). Everything else comes from `chart/values.yaml`.

See what Helm would create, without creating it:

```bash
helm template YOUR_USERNAME ./chart -f my-values.yaml
```

## 3. Install

Use **your name as the release name**: the namespace is shared, and the
release name is also the name of your objects.

```bash
helm install YOUR_USERNAME ./chart -f my-values.yaml
kubectl get pods -l app.kubernetes.io/instance=YOUR_USERNAME -w
```

Open `https://techbiolab.dev.bsc.es/YOUR_USERNAME/` again.

## 4. Change, look back, roll back

Change `path` to `YOUR_USERNAME-2` in `my-values.yaml`, then:

```bash
helm upgrade YOUR_USERNAME ./chart -f my-values.yaml
```

The app moves to `https://techbiolab.dev.bsc.es/YOUR_USERNAME-2/`: one line
changed, Helm updated all seven places. The old address no longer reaches
your app

```bash
helm list                          # releases in the namespace
helm get values YOUR_USERNAME      # what you installed with
helm history YOUR_USERNAME         # one line per install or upgrade
helm rollback YOUR_USERNAME 1      # back to revision 1 (your first path)
```

After the rollback, your app is back at `/YOUR_USERNAME/`, and
`helm history` shows the rollback as a new revision.
