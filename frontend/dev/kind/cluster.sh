#!/usr/bin/env bash
# Local stand-in for the workshop's Kubernetes cluster, to rehearse the event
# day on one machine. See docs/LOCAL.md ("Rehearse the event day on Kubernetes").
#
#   bash dev/kind/cluster.sh up     create everything (safe to run again)
#   bash dev/kind/cluster.sh down   delete the cluster and the registry
#
# What "up" creates:
#   - a registry at localhost:5001, standing in for ghcr.io
#   - a kind cluster "workshop" with Traefik as Ingress on http://localhost
#   - the name keycloak.localhost, for browsers and pods alike, pointing to the
#     local Keycloak from docker-compose.dev.yml (which runs outside the cluster,
#     like the shared Keycloak on the day)
#   - namespaces participant-1 and participant-2, each with the Keycloak
#     client secret, like the namespaces participants get on the day
set -euo pipefail

CLUSTER=workshop
REG_NAME=kind-registry
REG_PORT=5001
TRAEFIK_CHART_VERSION=42.4.1
NAMESPACES=(participant-1 participant-2)
# Dev-only secret from keycloak/realm-export.json.
CLIENT_SECRET=dev-only-secret-do-not-use-elsewhere
HERE=$(cd "$(dirname "$0")" && pwd)

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

up() {
  for tool in docker kind kubectl helm curl; do
    command -v "$tool" >/dev/null || die "$tool is not installed (see docs/LOCAL.md)."
  done
  curl -fsS -o /dev/null http://localhost:8080/realms/workshop ||
    die "The local Keycloak is not running. Start it first:
  docker compose -f docker-compose.dev.yml up -d keycloak && bash scripts/wait-for-keycloak.sh"

  step "Registry at localhost:${REG_PORT}"
  if [[ "$(docker inspect -f '{{.State.Running}}' "$REG_NAME" 2>/dev/null || true)" != true ]]; then
    docker rm -f "$REG_NAME" >/dev/null 2>&1 || true
    docker run -d --restart=always -p "127.0.0.1:${REG_PORT}:5000" -p "[::1]:${REG_PORT}:5000" \
      --name "$REG_NAME" registry:3 >/dev/null
  fi

  step "kind cluster \"${CLUSTER}\""
  if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
    # kind's default network also has IPv6, and then http://[::1]:80 is
    # forwarded to the node over IPv6, which Traefik's host port doesn't serve.
    # An IPv4-only network makes "localhost" work for IPv4 and IPv6 browsers.
    if ! docker network inspect kind >/dev/null 2>&1; then
      docker network create kind >/dev/null
    fi
    kind create cluster --name "$CLUSTER" --config "$HERE/cluster.yaml"
  fi
  kubectl config use-context "kind-${CLUSTER}" >/dev/null

  # Let the nodes pull localhost:5001/... from the registry container
  # (https://kind.sigs.k8s.io/docs/user/local-registry/).
  for node in $(kind get nodes --name "$CLUSTER"); do
    docker exec "$node" mkdir -p "/etc/containerd/certs.d/localhost:${REG_PORT}"
    printf '[host."http://%s:5000"]\n' "$REG_NAME" |
      docker exec -i "$node" cp /dev/stdin "/etc/containerd/certs.d/localhost:${REG_PORT}/hosts.toml"
  done
  if [[ "$(docker inspect -f '{{json .NetworkSettings.Networks.kind}}' "$REG_NAME")" == null ]]; then
    docker network connect kind "$REG_NAME"
  fi

  step "Traefik (Ingress) on http://localhost"
  helm upgrade --install traefik traefik --repo https://traefik.github.io/charts \
    --version "$TRAEFIK_CHART_VERSION" -n traefik --create-namespace \
    --set ports.web.hostPort=80 --set service.spec.type=ClusterIP --wait >/dev/null

  step "keycloak.localhost -> local Keycloak"
  # Browsers resolve *.localhost to this machine. Pods need a DNS entry for the
  # same name, pointing to this machine as seen from the cluster network.
  local gateway node
  gateway=$(docker network inspect kind -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' |
    tr ' ' '\n' | grep -m1 -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$') ||
    die "Could not find the IPv4 gateway of the docker network \"kind\"."
  node=$(kind get nodes --name "$CLUSTER" | head -1)
  docker exec "$node" curl -fsS -o /dev/null "http://${gateway}:8080/realms/workshop" ||
    die "The cluster cannot reach Keycloak at http://${gateway}:8080. A firewall may block traffic from Docker networks to this machine."
  local corefile
  corefile=$(kubectl -n kube-system get configmap coredns -o jsonpath='{.data.Corefile}')
  if ! grep -q "keycloak.localhost" <<<"$corefile"; then
    corefile=$(awk -v gw="$gateway" '
      { print }
      /^ *ready *$/ { print "    hosts {"; print "       " gw " keycloak.localhost"; print "       fallthrough"; print "    }" }
    ' <<<"$corefile")
    kubectl -n kube-system create configmap coredns --from-literal=Corefile="$corefile" \
      --dry-run=client -o yaml | kubectl replace -f - >/dev/null
    kubectl -n kube-system rollout restart deployment coredns >/dev/null
    kubectl -n kube-system rollout status deployment coredns --timeout=120s >/dev/null
  fi

  step "Participant namespaces: ${NAMESPACES[*]}"
  for ns in "${NAMESPACES[@]}"; do
    kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    kubectl -n "$ns" create secret generic workshop-keycloak \
      --from-literal=client-secret="$CLIENT_SECRET" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  done

  cat <<EOF

Ready. Deploy the app as a participant, like on the event day
(namespaces: ${NAMESPACES[*]}):

  cp my-values.example.yaml my-values.yaml
  helm install frontend dev/chart -n participant-1 -f my-values.yaml

Then open http://localhost/annie/ (user demo / demo).
EOF
}

down() {
  kind delete cluster --name "$CLUSTER"
  docker rm -f "$REG_NAME" >/dev/null 2>&1 || true
  echo "Deleted the cluster \"${CLUSTER}\" and the registry. The local Keycloak keeps running."
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) echo "Usage: bash dev/kind/cluster.sh up|down" >&2; exit 2 ;;
esac
