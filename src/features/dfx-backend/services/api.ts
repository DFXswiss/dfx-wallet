import { env } from '@/config/env';
import { constantTimeEqual } from '@/services/security/constant-time';

export type ApiError = {
  statusCode: number;
  code: string;
  message: string | string[];
};

export type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  responseType?: 'json' | 'text';
  timeoutMs?: number;
  /**
   * Reject before the request is sent when no Bearer is attached.
   * Link calls set this so a refresh-cleared token cannot turn POST /v1/auth
   * into an unauthenticated login.
   */
  requireAuth?: boolean;
  /**
   * Send no Authorization header, even when a token is set.
   * Login posts set this so a Bearer adopted while the challenge is signed
   * cannot turn POST /v1/auth into a link. Combining it with `requireAuth`
   * is a programming error.
   */
  anonymous?: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;

type PendingResponse = {
  response: Response;
  cleanup: () => void;
  didTimeOut: () => boolean;
  signal: AbortSignal;
  timeoutMs: number;
  /** True when this attempt's headers included Authorization. Captured at send time. */
  sentAuthorization: boolean;
};

type AuthRefreshResult = {
  generation: number;
  token: string | null;
};

class DfxApi {
  private baseUrl = env.dfxApiUrl;
  private authToken: string | null = null;
  private authGeneration = 0;
  private onUnauthorized: ((authGeneration: number) => Promise<string | null>) | null = null;
  private refreshPromise: Promise<AuthRefreshResult> | null = null;

  setAuthToken(token: string) {
    if (this.authToken !== null && constantTimeEqual(this.authToken, token)) return;
    this.authToken = token;
    this.authGeneration += 1;
  }

  /** Base URL exposed for code that needs to construct unauth GET URLs
   *  (e.g. the single-use CSV download key — server consumes the key on
   *  first read so we can't proxy it through the auth-injecting client). */
  baseUrlPublic(): string {
    return this.baseUrl;
  }

  clearAuthToken() {
    this.authToken = null;
    this.authGeneration += 1;
    this.refreshPromise = null;
  }

  /**
   * The 401 refresh flow must clear and replace its own token without changing
   * the generation it is validating. External auth changes use the public
   * setters above and therefore invalidate this generation-bound path.
   */
  clearAuthTokenForRefresh(authGeneration: number): boolean {
    if (authGeneration !== this.authGeneration) return false;
    this.authToken = null;
    return true;
  }

  setAuthTokenForRefresh(token: string, authGeneration: number): boolean {
    if (authGeneration !== this.authGeneration) return false;
    this.authToken = token;
    return true;
  }

  /** Register a callback to refresh the token on 401 */
  setOnUnauthorized(handler: (authGeneration: number) => Promise<string | null>) {
    this.onUnauthorized = handler;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * GET request without the Authorization header. Use for public catalog
   * endpoints (`/v1/asset`, `/v1/fiat`) — DFX filters those per-user when
   * the request is authenticated, returning a smaller subset that may not
   * contain the asset/fiat the buy/sell flow needs.
   */
  async getPublic<T>(path: string, options?: RequestOptions): Promise<T> {
    const pending = await this.fetch('GET', path, undefined, options, false);
    return this.consumeResponse<T>(pending, options?.responseType);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const pending = await this.fetch(method, path, body, options);

    // /v1/auth is both a login and an authenticated call. Skip the refresh
    // only when that request sent no Authorization (anonymous, or no token
    // was attached); refreshing that 401 would start another login. A request
    // that sent a Bearer, including requireAuth, still refreshes once. The
    // retry calls fetch again, so requireAuth reads the token the refresh
    // installed. Calls outside /v1/auth still refresh when they sent no Bearer.
    const authCallWithoutBearer = path.startsWith('/v1/auth') && !pending.sentAuthorization;
    if (pending.response.status === 401 && this.onUnauthorized && !authCallWithoutBearer) {
      let refreshResult: AuthRefreshResult;
      try {
        refreshResult = await this.raceRefreshWithRequest(this.refreshAuthToken(), pending);
      } catch (error) {
        pending.cleanup();
        throw error;
      }
      const refreshTokenIsCurrent =
        refreshResult.token !== null &&
        this.authToken !== null &&
        constantTimeEqual(this.authToken, refreshResult.token);
      // Legacy refresh handlers may install their own result through the public setter.
      if (refreshResult.generation !== this.authGeneration && !refreshTokenIsCurrent) {
        return this.consumeResponse<T>(pending, options?.responseType);
      }
      if (refreshResult.token) {
        this.authToken = refreshResult.token;
        pending.cleanup();
        const remainingTimeoutMs = deadline - Date.now();
        if (remainingTimeoutMs <= 0) throw new DfxApiTimeoutError(timeoutMs);
        try {
          const retryPending = await this.fetch(method, path, body, {
            ...options,
            timeoutMs: remainingTimeoutMs,
          });
          return await this.consumeResponse<T>(retryPending, options?.responseType);
        } catch (error) {
          // Report the original request budget, not the retry's remaining slice.
          if (error instanceof DfxApiTimeoutError) throw new DfxApiTimeoutError(timeoutMs);
          throw error;
        }
      }
    }

    return this.consumeResponse<T>(pending, options?.responseType);
  }

  private refreshAuthToken(): Promise<AuthRefreshResult> {
    if (!this.onUnauthorized) {
      return Promise.resolve({ generation: this.authGeneration, token: null });
    }
    if (!this.refreshPromise) {
      const generation = this.authGeneration;
      const refresh = this.onUnauthorized(generation).then((token) => ({ generation, token }));
      const sharedRefresh = refresh.finally(() => {
        if (this.refreshPromise === sharedRefresh) this.refreshPromise = null;
      });
      this.refreshPromise = sharedRefresh;
    }
    return this.refreshPromise;
  }

  private raceRefreshWithRequest(
    refresh: Promise<AuthRefreshResult>,
    pending: PendingResponse,
  ): Promise<AuthRefreshResult> {
    if (pending.signal.aborted) return Promise.reject(this.requestAbortError(pending));

    return new Promise<AuthRefreshResult>((resolve, reject) => {
      const onAbort = () => {
        pending.signal.removeEventListener('abort', onAbort);
        reject(this.requestAbortError(pending));
      };
      pending.signal.addEventListener('abort', onAbort, { once: true });
      void refresh.then(
        (token) => {
          pending.signal.removeEventListener('abort', onAbort);
          resolve(token);
        },
        (error: unknown) => {
          pending.signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  private requestAbortError(pending: PendingResponse): Error {
    if (pending.didTimeOut()) return new DfxApiTimeoutError(pending.timeoutMs);
    if (pending.signal.reason instanceof Error) return pending.signal.reason;
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }

  private async fetch(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
    authenticated = true,
  ): Promise<PendingResponse> {
    if (options?.anonymous === true && options?.requireAuth === true) {
      throw new Error('anonymous and requireAuth cannot be combined');
    }
    // Same path as getPublic: getHeaders omits Authorization when this is false.
    const attachAuth = authenticated && options?.anonymous !== true;
    // Read with the headers, before the await. A refresh may clear authToken
    // while this response is in flight; the 401 decision must follow the
    // Bearer this attempt sent, not the token left afterwards.
    const sentAuthorization = attachAuth && this.authToken !== null;
    const url = this.buildUrl(path);
    const controller = new AbortController();
    let timedOut = false;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const abortFromCaller = () => controller.abort();
    if (options?.signal?.aborted) controller.abort();
    else options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abortFromCaller);
    };
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(options?.headers, options?.requireAuth === true, attachAuth),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      return {
        response,
        cleanup,
        didTimeOut: () => timedOut,
        signal: controller.signal,
        timeoutMs,
        sentAuthorization,
      };
    } catch (error) {
      cleanup();
      if (timedOut) throw new DfxApiTimeoutError(timeoutMs);
      throw error;
    }
  }

  private async consumeResponse<T>(
    pending: PendingResponse,
    responseType?: 'json' | 'text',
  ): Promise<T> {
    try {
      return await this.handleResponse<T>(pending.response, responseType);
    } catch (error) {
      if (pending.didTimeOut()) throw new DfxApiTimeoutError(pending.timeoutMs);
      throw error;
    } finally {
      pending.cleanup();
    }
  }

  private buildUrl(path: string): string {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new DfxApiError(
        0,
        'INVALID_API_PATH',
        'DFX API requests must use relative paths so credentials cannot be sent off-domain.',
      );
    }
    return `${this.baseUrl}${path}`;
  }

  private async handleResponse<T>(
    response: Response,
    responseType: 'json' | 'text' = 'json',
  ): Promise<T> {
    if (!response.ok) {
      let apiError: ApiError;
      try {
        apiError = await response.json();
      } catch {
        apiError = {
          statusCode: response.status,
          code: 'UNKNOWN',
          message: `HTTP ${response.status}`,
        };
      }

      const message = Array.isArray(apiError.message)
        ? apiError.message.join(', ')
        : apiError.message;

      throw new DfxApiError(apiError.statusCode, apiError.code, message);
    }

    // Some DFX endpoints (e.g. POST /v1/auth/mail, PUT /v2/user/mail) return
    // 200/201/204 with an empty body. Read text first so we can distinguish
    // empty from JSON without crashing JSON.parse.
    const text = await response.text();
    if (!text) return undefined as T;
    if (responseType === 'text') return text as T;
    return JSON.parse(text) as T;
  }

  private getHeaders(
    extraHeaders: Record<string, string> | undefined,
    requireAuth: boolean,
    authenticated: boolean,
  ): Record<string, string> {
    // Read once. The check and the Authorization value stay on this snapshot,
    // with no await between them, so a refresh cannot clear the token after
    // the guard has passed and before the header is set.
    const token = this.authToken;
    if (requireAuth && token === null) {
      throw new Error('Authentication required');
    }
    if (!authenticated && !requireAuth) {
      return { 'Content-Type': 'application/json', ...extraHeaders };
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
}

export class DfxApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DfxApiError';
  }

  get isKycRequired(): boolean {
    return this.code === 'KYC_LEVEL_REQUIRED' || this.code === 'KYC_DATA_REQUIRED';
  }

  get isRegistrationRequired(): boolean {
    return this.code === 'REGISTRATION_REQUIRED';
  }
}

export class DfxApiTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`DFX API request timed out after ${timeoutMs} ms`);
    this.name = 'DfxApiTimeoutError';
  }
}

export const dfxApi = new DfxApi();
