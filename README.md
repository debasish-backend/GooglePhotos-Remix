# PicRemix

PicRemix is a Vite + React dashboard and Express API for selecting a Google Photos image and creating an AI remix with Gemini image generation.

## Setup

1. Copy `server/.env.example` to `server/.env` and fill in the Google OAuth and Gemini values.
2. In Google Cloud, enable the Google Photos Picker API and configure the OAuth redirect URI as `http://localhost:8787/api/auth/callback`.
3. Install all workspaces with `npm install`.
4. Run both applications with `npm run dev`.

The dashboard runs at `http://localhost:5173` and the API runs at `http://localhost:8787`.

## Production build

```bash
npm run build
npm run start --workspace server
```

The Gemini request is made server-side with `GEMINI_API_KEY`; it is never exposed to the browser. Sessions use an HTTP-only cookie and keep the Google access token out of the frontend.
