#!/usr/bin/env bash
# Waits until the local Keycloak has imported the "workshop" realm and answers.
# Usage: scripts/wait-for-keycloak.sh [url] [timeout-seconds]
set -euo pipefail

url="${1:-http://localhost:8080/realms/workshop/.well-known/openid-configuration}"
timeout="${2:-120}"

echo "Waiting for Keycloak at ${url} (up to ${timeout}s)..."
for ((i = 0; i < timeout; i++)); do
  if curl -fsS -o /dev/null "${url}" 2>/dev/null; then
    echo "Keycloak is ready."
    exit 0
  fi
  sleep 1
done

echo "Keycloak did not become ready within ${timeout}s." >&2
echo "Check the logs: docker compose -f docker-compose.dev.yml logs keycloak" >&2
exit 1
