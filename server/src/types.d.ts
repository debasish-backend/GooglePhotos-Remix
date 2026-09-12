import 'express-session'

declare module 'express-session' {
  interface SessionData {
    accessToken?: string
    refreshToken?: string
    oauthState?: string
    user?: { email: string }
  }
}
