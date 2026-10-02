/**
 * Shared fetch-level test doubles for the DfxApi wire-contract suites
 * (asset / fiat / payment / user / transaction / support).
 *
 * These were copy-pasted into each suite and had already begun to drift
 * (`call` vs `findCall`). Centralizing them keeps the wire contract pinned the
 * same way everywhere — a divergence in how a "recorded request" is read is
 * exactly how a funds-relevant assertion quietly stops asserting.
 */

/**
 * Minimal fetch Response double. `text()` drives api.ts' success path and
 * `json()` drives its error path (rejecting on non-JSON, like the real one).
 */
export function httpResponse(status: number, bodyText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText) as unknown,
  } as unknown as Response;
}

/** A 2xx JSON response; `undefined` body serializes to an empty string. */
export const jsonOk = (body: unknown, status = 200): Response =>
  httpResponse(status, body === undefined ? '' : JSON.stringify(body));

export type DfxFetchMock = jest.Mock<Promise<Response>, [string, RequestInit | undefined]>;

/**
 * The standard `globalThis.fetch` double for the DfxApi suites, plus helpers to
 * read recorded calls. Install/restore in beforeAll/afterAll via the returned
 * `fetchMock` and `realFetch`, and `fetchMock.mockReset()` per test:
 *
 *   const { fetchMock, realFetch, call, findCall } = createDfxFetchMock();
 *   beforeAll(() => { globalThis.fetch = fetchMock as unknown as typeof fetch; });
 *   afterAll(() => { globalThis.fetch = realFetch; });
 *
 *   call(i)       — the i-th recorded call's { url, init } (throws if absent).
 *   findCall(url) — the init of the first call to `url` (throws if absent).
 */
export function createDfxFetchMock(): {
  fetchMock: DfxFetchMock;
  realFetch: typeof globalThis.fetch;
  call: (index?: number) => { url: string; init: RequestInit };
  findCall: (url: string) => RequestInit;
} {
  const fetchMock: DfxFetchMock = jest.fn<Promise<Response>, [string, RequestInit | undefined]>();
  const realFetch = globalThis.fetch;

  return {
    fetchMock,
    realFetch,
    call(index = 0): { url: string; init: RequestInit } {
      const c = fetchMock.mock.calls[index];
      if (!c) throw new Error(`fetch call ${index} was not made`);
      return { url: c[0], init: c[1] ?? {} };
    },
    findCall(url: string): RequestInit {
      const c = fetchMock.mock.calls.find(([u]) => u === url);
      if (!c) throw new Error(`expected a fetch to ${url}`);
      return c[1] ?? {};
    },
  };
}
