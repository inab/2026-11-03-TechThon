import { hostname, networkInterfaces } from 'node:os'
import type { StackLayer } from '#shared/types/stack'

// The protected data: what this request went through, layer by layer, with
// real values. Returns 401 without a session (requireUserSession below).
// Called from the browser (not during server rendering), so the request really
// passes through the Ingress and the headers below are the real ones.
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const config = useRuntimeConfig(event)
  const kc = config.oauth.keycloak
  const header = (name: string) => getRequestHeader(event, name) || ''

  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  const onKubernetes = inKubernetes()
  const [namespace, k8sVersion, keycloakCheck] = await Promise.all([
    podNamespace(),
    kubernetesVersion(),
    pingKeycloak(`${kc.serverUrl}/realms/${kc.realm}/.well-known/openid-configuration`),
  ])
  const nodeName = process.env.NODE_NAME || ''
  const startedAt = new Date(Date.now() - process.uptime() * 1000)
  const appVersion = process.env.APP_VERSION || 'dev'
  const builtAt = process.env.APP_BUILD_TIME || ''
  const expiresAt = session.keycloak?.tokenExpiresAt
  const roles = session.keycloak?.roles ?? []

  const path = basePath().replace(/\/$/, '') || '/'

  // In the order the request travels, from outside to inside. Keycloak is not
  // on the request's path ("side"): it issued the session earlier, at login.
  // Node, pod, container and app are nested, not sequential ("depth").
  const layers: StackLayer[] = [
    {
      id: 'browser',
      title: 'Your browser',
      short: 'Sends the request',
      description: 'Sends the request, with your session cookie.',
      items: [
        { label: 'Page', value: `${url.protocol}//${url.host}${basePath()}protected` },
        { label: 'Session cookie path', value: String(config.session.cookie?.path || '/') },
        { label: 'Your address', value: getRequestIP(event, { xForwardedFor: true }) || 'unknown' },
      ],
    },
    {
      id: 'keycloak',
      title: 'Keycloak',
      short: 'Not in this request: issued your session',
      description: 'Not part of this request. You logged in here earlier, and it issued your session.',
      side: true,
      items: [
        { label: 'Server', value: String(kc.serverUrl) },
        { label: 'Realm / client', value: `${kc.realm} / ${kc.clientId}` },
        { label: 'Your name', value: session.user.name || '-' },
        { label: 'Your username', value: session.user.username || '-' },
        { label: 'Your email', value: session.user.email || '-' },
        { label: 'Your Keycloak ID', value: session.user.id },
        ...(roles.length ? [{ label: 'Your roles', value: roles.join(', ') }] : []),
        ...(session.loggedInAt ? [{ label: 'Logged in', value: new Date(session.loggedInAt).toISOString(), time: true }] : []),
        ...(expiresAt ? [{ label: 'Access token expires', value: new Date(expiresAt).toISOString(), time: true }] : []),
        { label: 'Reachable now', value: keycloakCheck.ok ? `yes, answered in ${keycloakCheck.ms} ms` : 'no' },
      ],
    },
    {
      id: 'ingress',
      title: 'Ingress',
      short: `Picks your app by ${path}`,
      description: `Receives it on the shared host and picks your app by the ${path} path.`,
      items: [
        { label: 'Host', value: url.host },
        { label: 'Protocol', value: url.protocol.replace(':', '') },
        { label: 'Path prefix', value: path },
        { label: 'Forwarded by', value: header('x-forwarded-server') || (header('x-forwarded-for') ? 'a proxy' : 'nobody (direct request)') },
      ],
    },
    ...(onKubernetes
      ? [
          {
            id: 'node',
            title: 'Kubernetes node',
            short: nodeName ? `The machine ${nodeName}` : 'The machine your pod runs on',
            description: 'The machine in the Kubernetes cluster that your pod runs on.',
            depth: 0,
            items: [
              { label: 'Node', value: nodeName || 'not provided by the chart' },
              ...(process.env.NODE_IP ? [{ label: 'Node IP', value: process.env.NODE_IP }] : []),
              { label: 'Kubernetes version', value: k8sVersion || 'unknown' },
              { label: 'Cluster API address', value: kubernetesApiAddress() },
            ],
          },
          {
            id: 'pod',
            title: 'Kubernetes pod',
            short: 'Inside the node: gets it from your Service',
            description: 'Runs on the node. Your app\'s Service hands the request to this pod.',
            depth: 1,
            items: [
              { label: 'Namespace', value: namespace || 'unknown' },
              { label: 'Pod', value: hostname() },
              { label: 'Pod IP', value: podIp() },
            ],
          },
        ]
      : [
          {
            id: 'pod',
            title: 'Server',
            short: 'Not on Kubernetes',
            description: 'Not running on Kubernetes: the request went straight to this machine.',
            depth: 1,
            items: [{ label: 'Host', value: hostname() }],
          },
        ]),
    {
      id: 'container',
      title: 'Container',
      short: `Inside the ${onKubernetes ? 'pod' : 'server'}: runs the image`,
      description: `Inside the ${onKubernetes ? 'pod' : 'server'}: runs the image, and Node.js receives the request.`,
      depth: 2,
      items: [
        { label: 'Image version', value: appVersion },
        ...(builtAt ? [{ label: 'Built', value: builtAt, time: true }] : []),
        { label: 'Started', value: startedAt.toISOString(), time: true },
        { label: 'Runtime', value: `Node ${process.version}, ${process.platform}/${process.arch}` },
        { label: 'User ID', value: String(process.getuid?.() ?? 'unknown') },
        { label: 'Memory in use', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB` },
      ],
    },
    {
      id: 'app',
      title: 'Nuxt app',
      short: 'Inside the container: checks your session',
      description: 'Inside the container: checks your session cookie and builds the answer.',
      depth: 3,
      items: [
        { label: 'Base path', value: basePath() },
        { label: 'Answered at', value: new Date().toISOString(), time: true },
      ],
    },
  ]

  return { layers }
})

async function pingKeycloak(url: string) {
  const start = performance.now()
  try {
    await $fetch(url, { timeout: 2000 })
    return { ok: true, ms: Math.round(performance.now() - start) }
  }
  catch {
    return { ok: false, ms: 0 }
  }
}

function podIp(): string {
  for (const list of Object.values(networkInterfaces())) {
    const ip = list?.find(item => item.family === 'IPv4' && !item.internal)
    if (ip) return ip.address
  }
  return 'unknown'
}
