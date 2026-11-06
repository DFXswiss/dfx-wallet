import { resolveIncomingPath } from '../../src/config/deep-links';

describe('resolveIncomingPath', () => {
  it.each([
    ['dfxwallet://buy', true],
    ['/(auth)/send?to=attacker', false],
    ['', true],
    ['not a valid URL', false],
  ])('rewrites external path %s to the root', (path, initial) => {
    expect(resolveIncomingPath(path, initial)).toBe('/');
  });
});
