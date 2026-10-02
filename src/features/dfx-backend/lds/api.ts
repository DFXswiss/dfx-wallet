/**
 * Lightning Decentralized Service (LDS) API client.
 *
 * LDS is the lightning.space backend that DFX uses to provision custodial
 * Lightning wallets. The sign-in flow:
 *
 *  1. Sign a static "ownership" message with the user's Bitcoin (SegWit)
 *     wallet — proves the SegWit address belongs to them.
 *  2. POST /auth with `{ address, signature, wallet: 'DFX Bitcoin' }` →
 *     receive a JWT.
 *  3. GET /user with the JWT → receive the user's Lightning address
 *     (e.g. `name@dfx.swiss`) plus per-asset LndHub URLs.
 *
 * The Lightning address is what surfaces as the "Taproot" receive option
 * inside the wallet — payments to it land on DFX's lightning.space-managed
 * custodial node, which routes Taproot Asset channels for stablecoins.
 */
const LDS_URL = process.env.EXPO_PUBLIC_LDS_URL ?? 'https://lightning.space/v1';

type LdsHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

class LdsApi {
  private baseUrl = LDS_URL;
  private accessToken: string | null = null;

  setAuthToken(token: string): void {
    this.accessToken = token;
  }

  clearAuthToken(): void {
    this.accessToken = null;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: LdsHttpMethod, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

    const response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      let message = `LDS HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as { message?: string };
        if (errBody.message) message = errBody.message;
      } catch {
        // body was not JSON; fall through with the generic status message.
      }
      throw new Error(message);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export const ldsApi = new LdsApi();
