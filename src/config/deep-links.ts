/**
 * Native URLs must enter through the authenticated in-app deep-link handler.
 * Expo Router therefore always starts at the root instead of resolving an
 * externally supplied path directly to a route.
 */
export function resolveIncomingPath(_path: string, _initial: boolean): string {
  return '/';
}
