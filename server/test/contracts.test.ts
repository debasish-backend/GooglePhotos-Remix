import assert from 'node:assert/strict'
import test from 'node:test'
import { isPickerSessionReady, parseGoogleDuration } from '@picremix/shared'
import { parseImageDataUrl, validateRemoteImageUrl } from '../src/image.js'

test('uses the Google Picker id and waits for mediaItemsSet', () => {
  assert.equal(isPickerSessionReady({ id: 'sessions/abc', mediaItemsSet: false }), false)
  assert.equal(isPickerSessionReady({ id: 'sessions/abc', mediaItemsSet: true }), true)
})

test('parses Google duration strings', () => {
  assert.equal(parseGoogleDuration('3s'), 3000)
  assert.equal(parseGoogleDuration('3.5s'), 3500)
  assert.equal(parseGoogleDuration(undefined, 7000), 7000)
})

test('extracts the real MIME type from image data URLs', () => {
  const parsed = parseImageDataUrl('data:image/png;base64,aGVsbG8=')
  assert.equal(parsed.mimeType, 'image/png')
  assert.deepEqual(parsed.buffer, Buffer.from('hello'))
  assert.throws(() => parseImageDataUrl('data:text/plain;base64,aGVsbG8='), /base64 image data URL/)
})

test('allows only HTTPS demo image hosts for remote images', () => {
  assert.doesNotThrow(() => validateRemoteImageUrl('https://images.unsplash.com/photo.jpg'))
  assert.throws(() => validateRemoteImageUrl('http://images.unsplash.com/photo.jpg'), /HTTPS/)
  assert.throws(() => validateRemoteImageUrl('https://example.com/photo.jpg'), /allowed image host/)
  assert.throws(() => validateRemoteImageUrl('http://127.0.0.1:8787/internal'), /HTTPS/)
})
