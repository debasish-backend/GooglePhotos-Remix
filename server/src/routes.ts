import crypto from 'node:crypto'
import { Router, type Request } from 'express'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type { PresetId } from '@picremix/shared'
import { config } from './config.js'
import { fetchRemoteImage, ImageInputError, parseImageDataUrl } from './image.js'
import { createAuthorizedClient, createGoogleAuthUrl, exchangeCode, fetchGooglePhoto } from './google.js'

const router = Router()
const presetPrompts: Record<PresetId, string> = {
  anime: 'Completely transform this image into a crisp, modern anime/manga art style. Maintain the exact pose, facial expressions, and clothing configuration of the primary subject.',
  cyberpunk: 'Isolate the foreground subject. Replace the entire background scene with a rain-slicked, neon-lit cyberpunk city alley at night with futuristic signs.',
  'oil-painting': 'Repaint this scene as a classic textured oil masterpiece with visible, heavy brushstrokes, rich impasto layers, and deep warm colors.',
  sketch: 'Convert this image into a highly detailed charcoal and graphite pencil sketch on textured off-white sketchpad paper.',
}

const remixSchema = z.object({
  baseUrl: z.string().min(1).max(12_000_000),
  presetId: z.enum(['anime', 'cyberpunk', 'oil-painting', 'sketch']).optional(),
  customPrompt: z.string().trim().max(1200).optional(),
})

const googleError = (message: string, statusCode = 502) => Object.assign(new Error(message), { statusCode })

const getGoogleContext = async (req: Request) => {
  const refreshToken = req.session.refreshToken ?? config.googleRefreshToken ?? undefined
  if (!req.session.accessToken && !refreshToken) return null
  const auth = createAuthorizedClient(req.session.accessToken, refreshToken)
  const token = (await auth.getAccessToken()).token
  if (!token) return null
  req.session.accessToken = token
  if (refreshToken) req.session.refreshToken = refreshToken
  return { auth, token }
}

const requireGoogleContext = async (req: Request) => {
  const context = await getGoogleContext(req)
  if (!context) throw googleError('Connect Google Photos first.', 401)
  return context
}

const readGoogleJson = async <T>(response: Response, label: string) => {
  if (!response.ok) throw googleError(`${label} (${response.status})`)
  return response.json() as Promise<T>
}

router.get('/health', (_req, res) => res.json({ ok: true, service: 'picremix-api' }))

router.get('/auth/google', (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ error: 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' })
  }
  const state = crypto.randomUUID()
  req.session.oauthState = state
  return res.redirect(createGoogleAuthUrl(state))
})

router.get('/auth/callback', async (req, res, next) => {
  try {
    if (typeof req.query.state !== 'string' || req.query.state !== req.session.oauthState) {
      return res.status(403).send('OAuth state validation failed')
    }
    if (typeof req.query.code !== 'string') return res.status(400).send('Missing OAuth code')
    const tokens = await exchangeCode(req.query.code)
    if (!tokens.access_token) return res.status(502).send('Google did not return an access token')
    req.session.accessToken = tokens.access_token
    req.session.refreshToken = tokens.refresh_token ?? req.session.refreshToken ?? config.googleRefreshToken ?? undefined
    req.session.user = { email: 'Google Photos connected' }
    return res.redirect(config.clientUrl)
  } catch (error) { return next(error) }
})

router.get('/auth/status', (req, res) => res.json({
  connected: Boolean(req.session.accessToken || req.session.refreshToken || config.googleRefreshToken),
  user: req.session.user ?? null,
}))

router.post('/auth/logout', (req, res) => req.session.destroy(() => res.json({ connected: false })))

router.post('/photos/picker-session', async (req, res, next) => {
  try {
    const { token } = await requireGoogleContext(req)
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickingConfig: { maxItemCount: '1' } }),
    })
    return res.json(await readGoogleJson(response, 'Google Photos Picker session failed'))
  } catch (error) { return next(error) }
})

router.get('/photos/picker-session/:sessionId', async (req, res, next) => {
  try {
    const { token } = await requireGoogleContext(req)
    const response = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(req.params.sessionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.json(await readGoogleJson(response, 'Google Photos Picker session status failed'))
  } catch (error) { return next(error) }
})

router.delete('/photos/picker-session/:sessionId', async (req, res, next) => {
  try {
    const { token } = await requireGoogleContext(req)
    const response = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(req.params.sessionId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw googleError(`Google Photos Picker session cleanup failed (${response.status})`)
    return res.status(204).end()
  } catch (error) { return next(error) }
})

router.get('/photos/picker-items/:sessionId', async (req, res, next) => {
  try {
    const { token } = await requireGoogleContext(req)
    const response = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(req.params.sessionId)}&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await readGoogleJson<{ mediaItems?: Array<{ id?: string; mediaFile?: { baseUrl?: string; filename?: string; mimeType?: string } }> }>(response, 'Google Photos Picker items failed')
    const item = payload.mediaItems?.[0]
    const mediaFile = item?.mediaFile
    if (!item || !mediaFile?.baseUrl) return res.json(payload)
    if (!mediaFile.mimeType?.startsWith('image/')) throw new ImageInputError('Please select an image, not a video.')
    const image = await fetchGooglePhoto(mediaFile.baseUrl, token)
    if (!image.mimeType.startsWith('image/')) throw new ImageInputError('Google Photos returned a non-image item.')
    return res.json({
      ...payload,
      mediaItems: [{
        ...item,
        mediaFile: {
          ...mediaFile,
          dataUrl: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`,
        },
      }],
    })
  } catch (error) { return next(error) }
})

router.post('/remix', async (req, res, next) => {
  try {
    if (!config.geminiApiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY.' })
    const input = remixSchema.parse(req.body)
    const image = input.baseUrl.startsWith('data:')
      ? parseImageDataUrl(input.baseUrl)
      : await fetchRemoteImage(input.baseUrl)
    const prompt = input.customPrompt || (input.presetId ? presetPrompts[input.presetId] : '')
    if (!prompt) return res.status(400).json({ error: 'Choose a preset or enter a custom prompt.' })
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey })
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: [{ role: 'user', parts: [
        { inlineData: { data: image.buffer.toString('base64'), mimeType: image.mimeType } },
        { text: `Edit the provided image according to this direction: ${prompt}. Return only the finished edited image.` },
      ] }],
    })
    const imagePart = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
    if (!imagePart?.inlineData?.data) return res.status(502).json({ error: 'Gemini returned no image output.' })
    return res.json({ imageData: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? 'image/png', prompt })
  } catch (error) { return next(error) }
})

export default router
