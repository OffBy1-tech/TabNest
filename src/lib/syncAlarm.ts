/**
 * Periodic sync-alarm policy (issue #11).
 *
 * sync_interval_minutes: null means "Manual only" — no periodic alarm may
 * exist. Every service-worker site that (re)creates the sync alarm derives
 * its config from this helper so the null case can't be forgotten: a null
 * return means "clear the alarm instead of creating one".
 *
 * Pure function, extracted from the service worker for unit testing.
 */

import type { LocalSettings } from './schema';
export function syncAlarmCreateInfo(
  interval: LocalSettings['sync_interval_minutes'],
): { periodInMinutes: number } | null {
  return interval === null ? null : { periodInMinutes: interval };
}
