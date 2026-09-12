export const PRESETS = ['anime', 'cyberpunk', 'oil-painting', 'sketch'] as const

export type PresetId = (typeof PRESETS)[number]

export interface PickerMediaItem {
  id: string
  baseUrl: string
  mimeType?: string
  filename?: string
}

export interface RemixRequest {
  baseUrl: string
  presetId?: PresetId
  customPrompt?: string
}

export interface RemixResponse {
  imageData: string
  mimeType: string
  prompt: string
}

export const isPickerSessionReady = (session: { mediaItemsSet?: boolean }) => session.mediaItemsSet === true

export const parseGoogleDuration = (value?: string, fallbackMs = 3000) => {
  if (!value) return fallbackMs
  const seconds = Number.parseFloat(value.endsWith('s') ? value.slice(0, -1) : value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : fallbackMs
}
