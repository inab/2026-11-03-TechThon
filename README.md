# Workshop frontend demo

A small Nuxt app that shows a login flow with Keycloak: public landing page → Keycloak login → protected page → logout. It ships as one Docker image, configured by environment variables. In the workshop, each participant deploys it to a shared Kubernetes cluster under their own path, e.g. `https://<host>/anni/`.

| Setup | For |
|---|---|
| [docs/LOCAL.md](docs/LOCAL.md) | Running and testing the app on your machine |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Whoever writes the Helm chart |
| [docs/KEYCLOAK.md](docs/KEYCLOAK.md) | Whoever runs the shared Keycloak |
| [docs/EVENT_DAY.md](docs/EVENT_DAY.md) | Participants on the day |
