import { env } from '@/config/env';

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
};

const DEFAULT_TIMEOUT_MS = 30_000;

class DfxApi {
  private baseUrl = env.dfxApiUrl;
  private authToken: string | null = null;
  private onUnauthorized: (() => Promise<string | null>) | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  setAuthToken(token: string) {
    this.authToken = token;
  }

  /** Base URL exposed for code that needs to construct unauth GET URLs
   *  (e.g. the single-use CSV download key — server consumes the key on
   *  first read so we can't proxy it through the auth-injecting client). */
  baseUrlPublic(): string {
    return this.baseUrl;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  /** Register a callback to refresh the token on 401 */
  setOnUnauthorized(handler: () => Promise<string | null>) {
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
    const response = await this.fetch('GET', path, undefined, options, false);
    return this.handleResponse<T>(response, options?.responseType);
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
    const response = await this.fetch(method, path, body, options);

    // Handle 401 — attempt token refresh once
    if (response.status === 401 && this.onUnauthorized && !path.startsWith('/v1/auth')) {
      const newToken = await this.refreshAuthToken();
      if (newToken) {
        this.authToken = newToken;
        const retryResponse = await this.fetch(method, path, body, options);
        return this.handleResponse<T>(retryResponse, options?.responseType);
      }
    }

    return this.handleResponse<T>(response, options?.responseType);
  }

  private refreshAuthToken(): Promise<string | null> {
    if (!this.onUnauthorized) return Promise.resolve(null);
    if (!this.refreshPromise) {
      this.refreshPromise = this.onUnauthorized().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async fetch(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
    authenticated = true,
  ): Promise<Response> {
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
    try {
      return await fetch(url, {
        method,
        headers: authenticated
          ? this.getHeaders(options?.headers)
          : { 'Content-Type': 'application/json', ...options?.headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new DfxApiTimeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abortFromCaller);
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

  private getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
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
