// Used by the Docker healthcheck. No auth, no external calls.
export default defineEventHandler(() => ({ status: 'ok' }))
