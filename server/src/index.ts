import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import { config } from './config.js'
import routes from './routes.js'

const app = express()
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: (origin, callback) => {
    const isDevelopmentOrigin = process.env.NODE_ENV !== 'production' && Boolean(origin?.match(/^http:\/\/localhost:\d+$/))
    if (!origin || origin === config.clientUrl || isDevelopmentOrigin) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '12mb' }))
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 },
}))
app.use('/api', routes)

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error)
  if (error?.name === 'ZodError') return res.status(400).json({ error: 'Invalid request payload.' })
  const statusCode = typeof error?.statusCode === 'number'
    ? error.statusCode
    : typeof error?.status === 'number'
      ? error.status
      : 500
  return res.status(statusCode).json({
    error: statusCode < 500 && error instanceof Error ? error.message : 'Unexpected server error.',
  })
}
app.use(errorHandler)
app.listen(config.port, () => console.log(`PicRemix API listening on http://localhost:${config.port}`))
