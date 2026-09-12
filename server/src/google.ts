import { google } from 'googleapis'
import { config, googleScopes } from './config.js'
import { MAX_IMAGE_BYTES } from './image.js'

export const oauthClient = new google.auth.OAuth2(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl,
)

export const createGoogleAuthUrl = (state: string) => oauthClient.generateAuthUrl({
  access_type: 'offline',
  scope: googleScopes,
  state,
  prompt: 'consent',
})

export const exchangeCode = async (code: string) => {
  const { tokens } = await oauthClient.getToken(code)
  return tokens
}

export const createAuthorizedClient = (accessToken?: string, refreshToken?: string) => {
  const client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret, config.googleCallbackUrl)
  client.setCredentials({
    ...(accessToken ? { access_token: accessToken } : {}),
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  })
  return client
}

export const fetchGooglePhoto = async (baseUrl: string, accessToken: string) => {
  const response = await fetch(`${baseUrl}=d`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Google Photos image download failed (${response.status})`)
  const mimeType = response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? 'image/jpeg'
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Google Photos image must be 8 MB or smaller.')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Google Photos returned an invalid image.')
  return { buffer, mimeType }
}
