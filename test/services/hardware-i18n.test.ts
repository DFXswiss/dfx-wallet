/**
 * Regression for CC-14 — every hardware-wallet status string and every
 * hardware.error.* key the UI calls MUST resolve to a non-empty value
 * in both en.json and de.json. Without this gate a user hitting an
 * error path saw the raw key string ("hardware.error.userAbort") which
 * trained the wrong mental model and prompted unsafe recovery actions.
 */

import en from '../../src/i18n/locales/en.json';
import de from '../../src/i18n/locales/de.json';

const STATUS_KEYS = [
  'connected',
  'connecting',
  'detected',
  'disconnected',
  'error',
  'reconnecting',
  'scanning',
  'verifying',
] as const;

const ERROR_KEYS = [
  'userAbort',
  'firmwareTooOld',
  'firmwareReject',
  'permissionDenied',
  'transport',
  'addressMismatch',
  'invalidPayload',
  'unknown',
] as const;

const CHANNEL_HASH_KEYS = ['channelHashLabel', 'channelHashCompare', 'channelHashMissing'] as const;

const TOP_LEVEL_KEYS = ['retry'] as const;

function get(o: Record<string, unknown>, path: string): string | undefined {
  const v = path
    .split('.')
    .reduce<unknown>(
      (acc, p) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined,
      o,
    );
  return typeof v === 'string' ? v : undefined;
}

describe('hardware-wallet i18n — every key called from the screen exists in en + de', () => {
  it.each(STATUS_KEYS)('hardware.status.%s is present in both locales', (k) => {
    const enVal = get(en as unknown as Record<string, unknown>, `hardware.status.${k}`);
    const deVal = get(de as unknown as Record<string, unknown>, `hardware.status.${k}`);
    expect(enVal).toBeTruthy();
    expect(deVal).toBeTruthy();
  });

  it.each(ERROR_KEYS)('hardware.error.%s is present in both locales', (k) => {
    const enVal = get(en as unknown as Record<string, unknown>, `hardware.error.${k}`);
    const deVal = get(de as unknown as Record<string, unknown>, `hardware.error.${k}`);
    expect(enVal).toBeTruthy();
    expect(deVal).toBeTruthy();
  });

  it.each(CHANNEL_HASH_KEYS)('hardware.%s (channel-hash copy) is present in both locales', (k) => {
    const enVal = get(en as unknown as Record<string, unknown>, `hardware.${k}`);
    const deVal = get(de as unknown as Record<string, unknown>, `hardware.${k}`);
    expect(enVal).toBeTruthy();
    expect(deVal).toBeTruthy();
  });

  it.each(TOP_LEVEL_KEYS)('hardware.%s (action label) is present in both locales', (k) => {
    const enVal = get(en as unknown as Record<string, unknown>, `hardware.${k}`);
    const deVal = get(de as unknown as Record<string, unknown>, `hardware.${k}`);
    expect(enVal).toBeTruthy();
    expect(deVal).toBeTruthy();
  });

  it('firmwareTooOld interpolation placeholders are present in both locales', () => {
    const enVal = get(en as unknown as Record<string, unknown>, 'hardware.error.firmwareTooOld')!;
    const deVal = get(de as unknown as Record<string, unknown>, 'hardware.error.firmwareTooOld')!;
    expect(enVal).toContain('{{actual}}');
    expect(enVal).toContain('{{minRequired}}');
    expect(deVal).toContain('{{actual}}');
    expect(deVal).toContain('{{minRequired}}');
  });
});
