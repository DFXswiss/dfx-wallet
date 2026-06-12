/**
 * Wire-contract tests for DfxSupportService. The createIssue body shape is
 * load-bearing: DFX' class-validator silently rejected the old
 * `{ reason, message }` body ("ticket never appears" bug), so the defaulted
 * type/reason/name fields are pinned exactly.
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import {
  dfxSupportService,
  type SupportIssueDto,
} from '../../src/features/dfx-backend/services/support-service';
import { env } from '../../src/config/env';

const BASE = env.dfxApiUrl;

function httpResponse(status: number, bodyText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText) as unknown,
  } as unknown as Response;
}

const jsonOk = (body: unknown, status = 200): Response =>
  httpResponse(status, body === undefined ? '' : JSON.stringify(body));

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit | undefined]>();
const realFetch = globalThis.fetch;

function call(index = 0): { url: string; init: RequestInit } {
  const c = fetchMock.mock.calls[index];
  if (!c) throw new Error(`fetch call ${index} was not made`);
  return { url: c[0], init: c[1] ?? {} };
}

const ISSUE: SupportIssueDto = {
  id: 5,
  uid: 'I-5',
  type: 'GenericIssue',
  state: 'Open',
  reason: 'Other',
  createdDate: '2025-05-01T10:00:00.000Z',
  messages: [
    { id: 1, message: 'Hello', author: 'User', createdDate: '2025-05-01T10:00:00.000Z' },
  ],
};

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxApi.setAuthToken('TEST_TOKEN');
  dfxApi.setOnUnauthorized(async () => null);
});

afterEach(() => {
  dfxApi.clearAuthToken();
});

describe('dfxSupportService.getIssues', () => {
  it('GETs /v1/support/issue authenticated and returns the tickets', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk([ISSUE]));

    const issues = await dfxSupportService.getIssues();

    expect(issues).toEqual([ISSUE]);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v1/support/issue`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init).not.toHaveProperty('body');
  });

  it('passes a JSON null body through instead of failing controlled', async () => {
    // NOTE: passes through unvalidated — null is delivered as the issue
    // list; callers iterating it crash at runtime.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxSupportService.getIssues()).resolves.toBeNull();
  });
});

describe('dfxSupportService.createIssue', () => {
  it('POSTs the full pinned body with explicit defaults for type and reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(ISSUE));

    const issue = await dfxSupportService.createIssue({
      name: 'Where is my money',
      message: 'My SEPA transfer has not arrived.',
    });

    expect(issue).toEqual(ISSUE);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v1/support/issue`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init.body).toBe(
      JSON.stringify({
        type: 'GenericIssue',
        reason: 'Other',
        name: 'Where is my money',
        message: 'My SEPA transfer has not arrived.',
      }),
    );
  });

  it('forwards concrete enum values for advanced flows', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(ISSUE));

    await dfxSupportService.createIssue({
      name: 'TX missing',
      message: 'Buy #12 missing',
      type: 'TransactionIssue',
      reason: 'FundsNotReceived',
    });

    expect(JSON.parse(call().init.body as string)).toEqual({
      type: 'TransactionIssue',
      reason: 'FundsNotReceived',
      name: 'TX missing',
      message: 'Buy #12 missing',
    });
  });

  it('trims the message and omits the key when it is empty or whitespace-only', async () => {
    fetchMock.mockResolvedValue(jsonOk(ISSUE));

    await dfxSupportService.createIssue({ name: 'A', message: '  hello  ' });
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      type: 'GenericIssue',
      reason: 'Other',
      name: 'A',
      message: 'hello',
    });

    await dfxSupportService.createIssue({ name: 'B', message: '' });
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      type: 'GenericIssue',
      reason: 'Other',
      name: 'B',
    });

    await dfxSupportService.createIssue({ name: 'C', message: '   \n\t ' });
    expect(JSON.parse(call(2).init.body as string)).toEqual({
      type: 'GenericIssue',
      reason: 'Other',
      name: 'C',
    });

    await dfxSupportService.createIssue({ name: 'D' });
    expect(JSON.parse(call(3).init.body as string)).toEqual({
      type: 'GenericIssue',
      reason: 'Other',
      name: 'D',
    });
  });

  it('sends the name verbatim — even empty or untrimmed', async () => {
    // NOTE: passes through unvalidated — `name` is required by the backend's
    // class-validator but the client neither trims nor rejects an empty
    // string, so a whitespace title silently relies on server-side rejection.
    fetchMock.mockResolvedValue(jsonOk(ISSUE));

    await dfxSupportService.createIssue({ name: '  ' });
    expect(JSON.parse(call(0).init.body as string).name).toBe('  ');

    await dfxSupportService.createIssue({ name: '' });
    expect(JSON.parse(call(1).init.body as string).name).toBe('');
  });

  it('passes a null response body through as the created issue', async () => {
    // NOTE: passes through unvalidated — a null body resolves as the
    // SupportIssueDto; the UI would treat the ticket as created with no id.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxSupportService.createIssue({ name: 'X' })).resolves.toBeNull();
  });

  it('propagates a structured 400 (validator rejection) as DfxApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 400, code: 'VALIDATION', message: ['name should not be empty'] }, 400),
    );

    const err = await dfxSupportService.createIssue({ name: '' }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).message).toBe('name should not be empty');
  });
});

describe('dfxSupportService.sendMessage', () => {
  it('POSTs to the issue-scoped message endpoint', async () => {
    const reply = { id: 2, message: 'Any update?', author: 'User' as const, createdDate: 'x' };
    fetchMock.mockResolvedValueOnce(jsonOk(reply));

    const msg = await dfxSupportService.sendMessage(42, 'Any update?');

    expect(msg).toEqual(reply);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v1/support/issue/42/message`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ message: 'Any update?' }));
  });

  it('does NOT trim or reject empty follow-up messages (unlike createIssue)', async () => {
    // NOTE: passes through unvalidated — inconsistent with createIssue's
    // trim-and-omit handling; an empty or whitespace message is sent verbatim.
    fetchMock.mockResolvedValue(jsonOk({ id: 3 }));

    await dfxSupportService.sendMessage(42, '   ');
    expect(call(0).init.body).toBe(JSON.stringify({ message: '   ' }));

    await dfxSupportService.sendMessage(42, '');
    expect(call(1).init.body).toBe(JSON.stringify({ message: '' }));
  });

  it('propagates a 404 for an unknown issue id', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 404, code: 'NOT_FOUND', message: 'Issue not found' }, 404),
    );

    const err = await dfxSupportService.sendMessage(999, 'hi').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(404);
  });

  it('propagates network-level rejections unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(dfxSupportService.sendMessage(1, 'hi')).rejects.toThrow(
      'Network request failed',
    );
  });
});
