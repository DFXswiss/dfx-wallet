import { dfxApi } from './api';
import type { AuthRequestDto, AuthResponseDto, SignMessageDto } from './dto';

/**
 * DFX authentication service.
 *
 * Flow:
 * 1. GET /v1/auth/signMessage?address=... → get challenge message
 * 2. Sign message with wallet (WDK or BitBox)
 * 3. POST /v1/auth → exchange signature for JWT
 */
export class DfxAuthService {
  private accessToken: string | null = null;

  /** Get the sign message challenge for an address */
  async getSignMessage(address: string): Promise<SignMessageDto> {
    return dfxApi.get<SignMessageDto>(`/auth/signMessage?address=${address}`);
  }

  /** Authenticate with a signed message and get a JWT */
  async authenticate(request: AuthRequestDto): Promise<string> {
    const response = await dfxApi.post<AuthResponseDto>('/auth', request);
    this.accessToken = response.accessToken;
    dfxApi.setAuthToken(response.accessToken);
    return response.accessToken;
  }

  /** Full auth flow: get challenge, sign, exchange for token */
  async login(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string; usedRef?: string },
  ): Promise<string> {
    const { message } = await this.getSignMessage(address);
    const signature = await signFn(message);

    return this.authenticate({
      address,
      signature,
      wallet: options?.wallet ?? 'DFX Wallet',
      blockchain: options?.blockchain,
      usedRef: options?.usedRef,
    });
  }

  /** Refresh auth token (re-sign challenge) */
  async refresh(
    address: string,
    signFn: (message: string) => Promise<string>,
  ): Promise<string> {
    return this.login(address, signFn);
  }

  /** Clear auth state */
  logout(): void {
    this.accessToken = null;
    dfxApi.clearAuthToken();
  }

  /** Check if authenticated */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /** Get current access token */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

export const dfxAuthService = new DfxAuthService();
