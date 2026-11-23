import { readFile } from 'node:fs/promises'
import { request } from 'node:https'

const SERVICE_ACCOUNT = '/var/run/secrets/kubernetes.io/serviceaccount'

export function inKubernetes(): boolean {
  return Boolean(process.env.KUBERNETES_SERVICE_HOST)
}

/** "host:port" of the Kubernetes API, as seen from inside the cluster. */
export function kubernetesApiAddress(): string {
  return `${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT || 443}`
}

export async function podNamespace(): Promise<string> {
  return (await readFile(`${SERVICE_ACCOUNT}/namespace`, 'utf8').catch(() => '')).trim()
}

let cachedVersion: string | undefined

/**
 * The cluster's Kubernetes version, e.g. "v1.37.0". Asked once with the pod's
 * own service account; every account may read /version by default, so no extra
 * permissions are needed. Empty if it can't be read.
 */
export async function kubernetesVersion(): Promise<string> {
  if (cachedVersion !== undefined) return cachedVersion
  if (!inKubernetes()) return ''

  const [token, ca] = await Promise.all([
    readFile(`${SERVICE_ACCOUNT}/token`, 'utf8').catch(() => ''),
    readFile(`${SERVICE_ACCOUNT}/ca.crt`).catch(() => undefined),
  ])
  if (!token || !ca) return ''

  const version = await new Promise<string>((resolve) => {
    const req = request({
      host: process.env.KUBERNETES_SERVICE_HOST,
      port: process.env.KUBERNETES_SERVICE_PORT || 443,
      path: '/version',
      ca,
      headers: { Authorization: `Bearer ${token.trim()}` },
      timeout: 2000,
    }, (res) => {
      let body = ''
      res.on('data', chunk => (body += chunk))
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 ? String(JSON.parse(body).gitVersion || '') : '')
        }
        catch {
          resolve('')
        }
      })
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(''))
    req.end()
  })

  // Only remember a success, so a temporary failure is retried next time.
  if (version) cachedVersion = version
  return version
}
