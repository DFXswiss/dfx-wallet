/**
 * Dev-only logs (Metro terminal, or Xcode when running iOS).
 * WDK balance fetches use the worklet — they are not the same as HTTP `fetch` in the debugger network list.
 */
export function debugLog(scope: string, message: string, data?: unknown): void {
  if (!__DEV__) return;
  if (data !== undefined) {
    // eslint-disable-next-line no-console -- intentional dev tracing
    console.log(`[DFX Wallet][${scope}] ${message}`, data);
  } else {
    // eslint-disable-next-line no-console -- intentional dev tracing
    console.log(`[DFX Wallet][${scope}] ${message}`);
  }
}
