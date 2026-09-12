export type PresetId = 'anime' | 'cyberpunk' | 'oil-painting' | 'sketch'

export interface PhotoSelection {
  baseUrl: string
  filename: string
  mimeType?: string
}

export interface PickerSession {
  id: string
  pickerUri?: string
  pollingConfig?: { pollInterval?: string; timeoutIn?: string }
  mediaItemsSet?: boolean
}

export interface PickerItemsResponse {
  mediaItems?: Array<{
    id?: string
    mediaFile?: { dataUrl?: string; filename?: string; mimeType?: string }
  }>
}

export interface Preset {
  id: PresetId
  label: string
  description: string
  color: string
  icon: string
}
