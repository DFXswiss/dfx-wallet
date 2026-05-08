import { env } from '@/config/env';

export type ApiError = {
  statusCode: number;
  code: string;
  message: string | string[];
};

class DfxApi {
  private baseUrl = env.dfxApiUrl;
  private authToken: string | null = null;
  private onUnauthorized: (() => Promise<string | null>) | null = null;

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

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * GET request without the Authorization header. Use for public catalog
   * endpoints (`/v1/asset`, `/v1/fiat`) — DFX filters those per-user when
   * the request is authenticated, returning a smaller subset that may not
   * contain the asset/fiat the buy/sell flow needs.
   */
  async getPublic<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    const response = await this.fetch(method, path, body, options?.signal);

    // Handle 401 — attempt token refresh once
    if (response.status === 401 && this.onUnauthorized) {
      const newToken = await this.onUnauthorized();
      if (newToken) {
        this.authToken = newToken;
        const retryResponse = await this.fetch(method, path, body, options?.signal);
        return this.handleResponse<T>(retryResponse);
      }
    }

    return this.handleResponse<T>(response);
  }

  private async fetch(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    return fetch(url, {
      method,
      headers: this.getHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  }

  private async handleResponse<T>(response: Response): Promise<T> {
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
    return JSON.parse(text) as T;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

export const dfxApi = new DfxApi();
