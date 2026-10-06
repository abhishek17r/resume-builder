// Client for the local AI server. Set VITE_API_URL to point elsewhere.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function request(method, path, body) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(`Can’t reach the local AI server at ${API_URL}. Start it with npm run dev.`, 'offline', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.error?.message || `Request failed (${res.status})`, data?.error?.code || 'error', res.status)
  return data
}

export const post = (path, body) => request('POST', path, body)

export async function health() {
  try {
    const res = await fetch(`${API_URL}/health`)
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}
