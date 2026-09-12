import 'dotenv/config'

const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  sessionSecret: required('SESSION_SECRET', 'replace-this-session-secret'),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8787/api/auth/callback',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
}

export const googleScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
]
