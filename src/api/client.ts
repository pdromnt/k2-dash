export class ApiError extends Error {
  status: number
  body: string
  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const HOST = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
const API_PORT = import.meta.env.VITE_API_PORT || '7125'

/**
 * Base URL for the Moonraker REST API.
 * Dev: routed through the Vite proxy (configured in vite.config.ts) to avoid CORS.
 * Prod: direct connection to the printer — requires the dashboard to be served
 *       from a host that can reach the printer on the LAN.
 */
function getBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/moonraker'
  return `http://${HOST}:${API_PORT}`
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}`

  const resp = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new ApiError(
      `HTTP ${resp.status}: ${resp.statusText}`,
      resp.status,
      body
    )
  }

  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return resp.json()
  }
  return resp.text() as unknown as T
}

export const api = {
  get<T>(path: string) {
    return request<T>(path)
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' })
  },
}
