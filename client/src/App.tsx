import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, Cloud, Download, ImagePlus, LoaderCircle, LockKeyhole, Sparkles, WandSparkles } from 'lucide-react'
import { isPickerSessionReady, parseGoogleDuration } from '@picremix/shared'
import { api } from './api'
import type { PhotoSelection, Preset, PresetId } from './types'
import './App.css'

const demoPhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1400&q=85'
const MAX_LOCAL_IMAGE_BYTES = 8 * 1024 * 1024
const presets: Preset[] = [
  { id: 'anime', label: 'Anime', description: 'Ink + cel shade', color: '#f1a7a0', icon: '✦' },
  { id: 'cyberpunk', label: 'Cyberpunk', description: 'Neon nightfall', color: '#b2d6c2', icon: '⌁' },
  { id: 'oil-painting', label: 'Oil Masterpiece', description: 'Rich impasto', color: '#e1c28f', icon: '◌' },
  { id: 'sketch', label: 'Sketch', description: 'Graphite study', color: '#c8c8c5', icon: '／' },
]

function App() {
  const [photo, setPhoto] = useState<PhotoSelection>({ baseUrl: demoPhoto, filename: 'portrait-study.jpg' })
  const [activePreset, setActivePreset] = useState<PresetId>('anime')
  const [customPrompt, setCustomPrompt] = useState('')
  const [remixedImage, setRemixedImage] = useState<string | null>(null)
  const [isRemixing, setIsRemixing] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { api.status().then((result) => setConnected(result.connected)).catch(() => undefined) }, [])

  const selectFromGoogle = async () => {
    setError('')
    setPickerLoading(true)
    let sessionId = ''
    try {
      const session = await api.createPickerSession()
      sessionId = session.id
      if (!sessionId) throw new Error('Google Photos did not return a Picker session ID.')
      if (session.pickerUri) {
        const pickerWindow = window.open(`${session.pickerUri.replace(/\/$/, '')}/autoclose`, '_blank', 'noopener,noreferrer')
        if (!pickerWindow) throw new Error('The Google Photos Picker popup was blocked. Allow popups and try again.')
      }
      setError('Picker opened in a new tab. Select one photo, then return here to continue.')
      const pollInterval = Math.max(1000, parseGoogleDuration(session.pollingConfig?.pollInterval))
      const timeout = parseGoogleDuration(session.pollingConfig?.timeoutIn, 60_000)
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, pollInterval))
        const status = await api.getPickerSession(sessionId)
        if (!isPickerSessionReady(status)) continue
        const result = await api.getPickerItems(sessionId)
        const item = result.mediaItems?.[0]
        const dataUrl = item?.mediaFile?.dataUrl
        if (dataUrl) {
          setPhoto({ baseUrl: dataUrl, filename: item.mediaFile?.filename ?? 'google-photos-selection.jpg', mimeType: item.mediaFile?.mimeType })
          setRemixedImage(null)
          setError('Photo selected from Google Photos.')
          return
        }
        throw new Error('Google Photos returned no selectable image.')
      }
      throw new Error('Google Photos selection timed out. Please try again.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open Google Photos Picker') } finally {
      if (sessionId) await api.deletePickerSession(sessionId).catch(() => undefined)
      setPickerLoading(false)
    }
  }

  const selectLocalFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (file.size > MAX_LOCAL_IMAGE_BYTES) { setError('Image must be 8 MB or smaller.'); return }
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        setPhoto({ baseUrl: reader.result, filename: file.name, mimeType: file.type })
        setRemixedImage(null)
      }
    })
    reader.readAsDataURL(file)
  }

  const remix = async () => {
    setError('')
    setIsRemixing(true)
    try {
      const result = await api.remix({ baseUrl: photo.baseUrl, presetId: activePreset, customPrompt: customPrompt || undefined })
      setRemixedImage(`data:${result.mimeType};base64,${result.imageData}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Remix failed') } finally { setIsRemixing(false) }
  }

  const download = () => {
    if (!remixedImage) return
    const link = document.createElement('a')
    link.href = remixedImage
    link.download = `picremix-${activePreset}.png`
    link.click()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><Sparkles size={18} /></div><div><div className="brand-name">PicRemix</div><div className="brand-tagline">your photos, reimagined</div></div></div>
        <div className="header-actions"><span className={`connection-pill ${connected ? 'is-connected' : ''}`}><span className="connection-dot" />{connected ? 'Connected to Google Photos' : 'Demo workspace'}</span><button className="avatar" aria-label="Account menu">AP</button></div>
      </header>
      <section className="workspace-heading"><div><p className="eyebrow">CREATIVE STUDIO / 01</p><h1>Make something <em>unexpected.</em></h1><p className="intro">Choose a visual direction, or write your own. PicRemix keeps the soul of your original while opening a new door.</p></div><div className="heading-note"><LockKeyhole size={16} /><span>Your originals stay private</span></div></section>
      <section className="control-strip"><div className="source-control"><div className="control-icon"><Cloud size={17} /></div><div><span className="control-label">SOURCE IMAGE</span><strong>{photo.filename}</strong></div><button className="text-button" onClick={() => fileInput.current?.click()}>Change <ArrowUpRight size={14} /></button><input ref={fileInput} hidden type="file" accept="image/*" onChange={selectLocalFile} /></div><div className="strip-divider" /><button className="google-button" onClick={connected ? selectFromGoogle : () => window.location.assign(api.connectUrl)} disabled={pickerLoading}><ImagePlus size={17} />{pickerLoading ? 'Opening Picker...' : connected ? 'Select from Google Photos' : 'Connect Google Photos'}<ArrowUpRight size={15} /></button></section>
      {error && <div className="notice"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      <section className="studio-grid">
        <div className="preview-column"><div className="section-heading"><div><span className="section-kicker">THE CANVAS</span><h2>See the shift</h2></div><span className="format-select">4:5 portrait <ChevronDown size={14} /></span></div><div className="preview-grid"><div className="image-frame"><span className="image-label">ORIGINAL</span><img src={photo.baseUrl} alt="Original selected portrait" /></div><div className={`image-frame output-frame ${isRemixing ? 'is-loading' : ''}`}><span className="image-label">REMIXED OUTPUT</span>{remixedImage ? <img src={remixedImage} alt="AI remixed portrait" /> : <div className="empty-output"><div className="empty-orbit"><WandSparkles size={24} /></div><span>Your remix will appear here</span><small>Pick a style and press remix</small></div>}{isRemixing && <div className="loading-overlay"><LoaderCircle className="spinner" size={30} /><strong>AI is painting your remix...</strong><span>This can take a little moment</span></div>}</div></div><div className="canvas-meta"><span><span className="meta-dot" />Original preserved</span><span>Output quality: High</span></div></div>
        <aside className="preset-column"><div className="section-heading"><div><span className="section-kicker">DIRECTION</span><h2>Choose a mood</h2></div><span className="step-count">02 / 03</span></div><div className="preset-grid">{presets.map((preset) => <button key={preset.id} className={`preset-card ${activePreset === preset.id ? 'is-active' : ''}`} onClick={() => setActivePreset(preset.id)}><span className="preset-art" style={{ backgroundColor: preset.color }}><span>{preset.icon}</span>{activePreset === preset.id && <i><Check size={13} /></i>}</span><span className="preset-copy"><strong>{preset.label}</strong><small>{preset.description}</small></span></button>)}</div><label className="prompt-label" htmlFor="prompt">CUSTOM REMIX PROMPT <span>OPTIONAL</span></label><textarea id="prompt" value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="e.g. Add soft afternoon light and wildflowers..." rows={4} /><div className="prompt-footer"><span>{customPrompt.length} / 1200</span><span>⌘ ↵ to remix</span></div><button className="remix-button" onClick={remix} disabled={isRemixing}><WandSparkles size={18} />{isRemixing ? 'Creating your remix...' : 'Remix this photo'}<span>↗</span></button></aside>
      </section>
      <footer className="bottom-bar"><div><span className="footer-status"><span className="status-check"><Check size={12} /></span>Ready to create</span><span className="footer-separator">·</span><span>Gemini image engine</span></div><div className="footer-actions"><button className="save-link" type="button"><Cloud size={16} />Save back to Google Photos <span className="soon">Soon</span></button><button className="download-button" onClick={download} disabled={!remixedImage}><Download size={16} />Download Remix</button></div></footer>
    </main>
  )
}

export default App
