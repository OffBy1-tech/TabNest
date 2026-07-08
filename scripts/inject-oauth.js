/**
 * inject-oauth.js
 * Replaces the __OAUTH_CLIENT_ID__ placeholder in the built manifest.json
 * with the real OAuth client ID from the TABNEST_OAUTH_CLIENT_ID env var.
 * Also syncs the manifest "version" field from package.json so the two
 * never drift (package.json is the single source of truth).
 *
 * Usage: node scripts/inject-oauth.js
 * Run after `npm build`.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.prod (production) or .env.local (development) — Node doesn't auto-load .env files
const envFileName = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.local'
const envLocalPath = join(__dirname, '..', envFileName)
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

const manifestPath = join(__dirname, '..', 'dist', 'manifest.json')

// Sync the manifest version from package.json (single source of truth).
// Done before the OAuth guards below so it always runs, even when OAuth/key
// env vars are unset.
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
const manifestWithVersion = readFileSync(manifestPath, 'utf8').replace(
  /("version"\s*:\s*)"[^"]*"/,
  `$1"${version}"`,
)
writeFileSync(manifestPath, manifestWithVersion, 'utf8')
console.log(`[inject-version] manifest version set to ${version}`)

const clientId = process.env.TABNEST_OAUTH_CLIENT_ID

if (!clientId) {
  console.warn('[inject-oauth] TABNEST_OAUTH_CLIENT_ID is not set — Drive sync will be disabled.')
  process.exit(0)
}

const manifestKey = process.env.GOOGLE_EXTENSION_KEY

if (!manifestKey) {
  console.warn('[inject extension key] GOOGLE_EXTENSION_KEY is not set')
  process.exit(0)
}

const manifest = readFileSync(manifestPath, 'utf8')
let patched = manifest.replace('__OAUTH_CLIENT_ID__', clientId)
patched = patched.replace('__GOOGLE_EXTENSION_KEY__', manifestKey)

writeFileSync(manifestPath, patched, 'utf8')
console.log('[inject-oauth] OAuth client ID injected into dist/manifest.json')
console.log('[inject-oauth] Extension Key injected into dist/manifest.json')
