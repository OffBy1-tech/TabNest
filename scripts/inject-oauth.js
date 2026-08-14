/**
 * inject-oauth.js
 * Post-build step for dist/manifest.json. It:
 *   - syncs the "version" field from package.json (the single source of truth),
 *   - inserts the extension "key" from GOOGLE_EXTENSION_KEY,
 *   - fills oauth2.client_id from TABNEST_OAUTH_CLIENT_ID.
 *
 * The key and client ID are *inserted* rather than substituted for placeholders,
 * so the checked-in manifest.json stays a valid manifest. That matters for
 * `npm run dev`: vite-plugin-web-extension writes its own dev manifest without
 * running this script, and Chrome rejects a manifest whose "key" is not a real
 * base64 RSA public key ("Value 'key' is missing or invalid"), which used to
 * kill the dev server on launch.
 *
 * Usage: node scripts/inject-oauth.js   (run after `vite build`)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Load .env.prod (production) or .env.local (development) — Node doesn't auto-load .env files
const envFileName = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.local'
const envLocalPath = join(rootDir, envFileName)
if (existsSync(envLocalPath)) {
  const lines = readFileSync(envLocalPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const manifestPath = join(rootDir, 'dist', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

// Version comes from package.json so the two can never drift.
const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
manifest.version = version
console.log(`[inject-version] manifest version set to ${version}`)

const manifestKey = process.env.GOOGLE_EXTENSION_KEY
if (manifestKey) {
  manifest.key = manifestKey
  console.log('[inject-oauth] Extension key injected into dist/manifest.json')
} else {
  console.warn(
    '[inject-oauth] GOOGLE_EXTENSION_KEY is not set — the build will get a random extension ID.',
  )
}

const clientId = process.env.TABNEST_OAUTH_CLIENT_ID
if (clientId) {
  manifest.oauth2 = { ...manifest.oauth2, client_id: clientId }
  console.log('[inject-oauth] OAuth client ID injected into dist/manifest.json')
} else {
  console.warn('[inject-oauth] TABNEST_OAUTH_CLIENT_ID is not set — Drive sync will be disabled.')
}

writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')
