const ALLOWED_REMOTE_IMAGE_HOSTS = new Set(['images.unsplash.com'])

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export class ImageInputError extends Error {
  statusCode = 400
}

export const parseImageDataUrl = (value: string) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(value)
  if (!match) throw new ImageInputError('Source must be a base64 image data URL.')
  const mimeType = match[1].toLowerCase()
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ImageInputError('Image must be between 1 byte and 8 MB.')
  return { mimeType, buffer }
}

export const validateRemoteImageUrl = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new ImageInputError('Remote images must use HTTPS.')
  if (!ALLOWED_REMOTE_IMAGE_HOSTS.has(url.hostname)) throw new ImageInputError('Remote image host is not an allowed image host.')
  return url
}

export const fetchRemoteImage = async (value: string) => {
  const url = validateRemoteImageUrl(value)
  const response = await fetch(url)
  if (!response.ok) throw new ImageInputError(`Unable to download source image (${response.status})`)
  const mimeType = response.headers.get('content-type')?.split(';')[0].toLowerCase()
  if (!mimeType?.startsWith('image/')) throw new ImageInputError('Remote source is not an image.')
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_IMAGE_BYTES) throw new ImageInputError('Image must be 8 MB or smaller.')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ImageInputError('Image must be between 1 byte and 8 MB.')
  return { mimeType, buffer }
}
