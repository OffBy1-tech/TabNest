/**
 * messaging.ts
 * The one way UI contexts talk to the background service worker.
 *
 * Every failure mode — chrome.runtime.lastError, a missing responder, or a
 * non-extension context (Vitest / Storybook / dev server) — resolves to
 * { ok: false } instead of throwing, so callers handle a single shape.
 */

import type { ExtensionMessage, MessageResponse } from './schema'

export function sendExtensionMessage<T = unknown>(
  message: ExtensionMessage,
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: MessageResponse<T> | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'Extension error' })
        } else {
          resolve(response ?? { ok: false, error: 'No response from background' })
        }
      })
    } catch {
      resolve({ ok: false, error: 'Not running as an extension' })
    }
  })
}
