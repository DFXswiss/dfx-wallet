// The unit project maps `react-native` to an empty module, so we stub
// `Platform` directly: each test sets the OS + Version then imports the
// module fresh via `jest.isolateModules` to pick up the new values.
const platformStub = { OS: 'ios' as string, Version: '18' as string | number };
jest.mock('react-native', () => ({ Platform: platformStub }));

import type { isPasskeyOsSupported as IsPasskeyOsSupported } from '../../src/config/platform';

function loadIsPasskeyOsSupported(): typeof IsPasskeyOsSupported {
  let fn: typeof IsPasskeyOsSupported | undefined;
  jest.isolateModules(() => {
    fn = require('../../src/config/platform').isPasskeyOsSupported;
  });
  if (!fn) throw new Error('module did not load');
  return fn;
}

describe('isPasskeyOsSupported', () => {
  function setPlatform(os: string, version: string | number) {
    platformStub.OS = os;
    platformStub.Version = version;
  }

  // Local alias so each `it` reads the freshly-resolved boolean from the
  // current `platformStub` state.
  const isPasskeyOsSupported = () => loadIsPasskeyOsSupported()();

  it('returns true on iOS 18+', () => {
    setPlatform('ios', '18.0');
    expect(isPasskeyOsSupported()).toBe(true);
    setPlatform('ios', '19.2');
    expect(isPasskeyOsSupported()).toBe(true);
  });

  it('returns false on iOS below 18', () => {
    setPlatform('ios', '17.4');
    expect(isPasskeyOsSupported()).toBe(false);
    setPlatform('ios', '15.0');
    expect(isPasskeyOsSupported()).toBe(false);
  });

  it('returns true on Android API 34+ (numeric Platform.Version)', () => {
    setPlatform('android', 34);
    expect(isPasskeyOsSupported()).toBe(true);
    setPlatform('android', 35);
    expect(isPasskeyOsSupported()).toBe(true);
  });

  it('returns false on Android below API 34', () => {
    setPlatform('android', 33);
    expect(isPasskeyOsSupported()).toBe(false);
    setPlatform('android', 29);
    expect(isPasskeyOsSupported()).toBe(false);
  });

  it('returns false on web / desktop platforms', () => {
    setPlatform('web', 'n/a');
    expect(isPasskeyOsSupported()).toBe(false);
    setPlatform('macos', '14');
    expect(isPasskeyOsSupported()).toBe(false);
  });
});
