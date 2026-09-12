import type { PickerItemsResponse, PickerSession } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'

const readResponse = async <T>(response: Response, fallback: string) => {
  const text = await response.text()
  let body: { error?: string } & T = {} as { error?: string } & T
  if (text) {
    try { body = JSON.parse(text) as { error?: string } & T } catch { /* use fallback below */ }
  }
  if (!response.ok) throw new Error(body.error ?? fallback)
  return body
}

export const api = {
  status: async () => fetch(`${API_URL}/auth/status`, { credentials: 'include' }).then((response) => readResponse<{ connected: boolean; user: { email: string } | null }>(response, 'Could not read connection status')),
  connectUrl: `${API_URL}/auth/google`,
  createPickerSession: async () => fetch(`${API_URL}/photos/picker-session`, { method: 'POST', credentials: 'include' }).then((response) => readResponse<PickerSession>(response, 'Could not open Google Photos Picker')),
  getPickerSession: async (sessionId: string) => fetch(`${API_URL}/photos/picker-session/${encodeURIComponent(sessionId)}`, { credentials: 'include' }).then((response) => readResponse<PickerSession>(response, 'Could not read Google Photos Picker status')),
  getPickerItems: async (sessionId: string) => fetch(`${API_URL}/photos/picker-items/${encodeURIComponent(sessionId)}`, { credentials: 'include' }).then((response) => readResponse<PickerItemsResponse>(response, 'Could not read the selected photo')),
  deletePickerSession: async (sessionId: string) => fetch(`${API_URL}/photos/picker-session/${encodeURIComponent(sessionId)}`, { method: 'DELETE', credentials: 'include' }).then((response) => readResponse<Record<string, never>>(response, 'Could not clean up Google Photos Picker session')),
  remix: async (payload: { baseUrl: string; presetId?: string; customPrompt?: string }) => fetch(`${API_URL}/remix`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then((response) => readResponse<{ imageData: string; mimeType: string; prompt: string }>(response, 'Remix failed')),
}
