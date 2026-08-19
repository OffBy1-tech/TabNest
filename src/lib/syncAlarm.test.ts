import { describe, expect, it } from 'vitest';
import { syncAlarmCreateInfo } from './syncAlarm';
describe('syncAlarmCreateInfo', () => {
  it('returns a periodic alarm config for numeric intervals', () => {
    expect(syncAlarmCreateInfo(5)).toEqual({ periodInMinutes: 5 });
    expect(syncAlarmCreateInfo(15)).toEqual({ periodInMinutes: 15 });
    expect(syncAlarmCreateInfo(30)).toEqual({ periodInMinutes: 30 });
  });
  it('returns null for manual-only (no periodic alarm may exist)', () => {
    expect(syncAlarmCreateInfo(null)).toBeNull();
  });
});
