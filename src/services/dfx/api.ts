import { env } from '@/config/env';
import { debugLog } from '@/utils/debugLog';

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

  clearAuthToken() {
    this.authToken = null;
  }

  /** Register a callback to refresh the token on 401 */
  setOnUnauthorized(handler: () => Promise<string | null>) {
    this.onUnauthorized = handler;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetch(method, path, body);

    // Handle 401 — attempt token refresh once
    if (response.status === 401 && this.onUnauthorized) {
      const newToken = await this.onUnauthorized();
      if (newToken) {
        this.authToken = newToken;
        const retryResponse = await this.fetch(method, path, body);
        return this.handleResponse<T>(retryResponse);
      }
    }

    return this.handleResponse<T>(response);
  }

  private async fetch(method: string, path: string, body?: unknown): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    debugLog('DFX API', `${method} ${path}`, { url, hasAuth: Boolean(this.authToken) });
    return fetch(url, {
      method,
      headers: this.getHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
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
