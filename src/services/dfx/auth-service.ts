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
    return dfxApi.get<SignMessageDto>(`/v1/auth/signMessage?address=${address}`);
  }

  /** Authenticate with a signed message and get a JWT */
  async authenticate(request: AuthRequestDto): Promise<string> {
    const response = await dfxApi.post<AuthResponseDto>('/v1/auth', request);
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
      ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
      ...(options?.usedRef !== undefined ? { usedRef: options.usedRef } : {}),
    });
  }

  /** Refresh auth token (re-sign challenge) */
  async refresh(address: string, signFn: (message: string) => Promise<string>): Promise<string> {
    return this.login(address, signFn);
  }

  /**
   * Trigger an email-based sign-in. The backend sends an email containing a
   * confirmation link with an `?otp=` token. The user pastes either the full
   * link or just the otp into the app, which we then exchange via
   * {@link confirmMailLogin} for a JWT.
   *
   * Mirrors `@dfx.swiss/react`'s `useAuth().signInWithMail`.
   */
  async requestMailLogin(
    mail: string,
    options?: { redirectUri?: string; wallet?: string; recommendationCode?: string },
  ): Promise<void> {
    await dfxApi.post('/v1/auth/mail', {
      mail,
      ...(options?.redirectUri !== undefined ? { redirectUri: options.redirectUri } : {}),
      ...(options?.wallet !== undefined ? { wallet: options.wallet } : {}),
      ...(options?.recommendationCode !== undefined
        ? { recommendationCode: options.recommendationCode }
        : {}),
    });
  }

  /**
   * Exchange the email confirmation otp for an access token. Sets the API
   * client to use the new token and returns it.
   */
  async confirmMailLogin(otp: string): Promise<string> {
    const response = await dfxApi.get<{ accessToken: string; kycHash?: string }>(
      `/v1/auth/mail/confirm?code=${encodeURIComponent(otp)}`,
    );
    this.accessToken = response.accessToken;
    dfxApi.setAuthToken(response.accessToken);
    return response.accessToken;
  }

  /**
   * Link a new wallet address to the currently authenticated DFX account.
   *
   * Posts to /v1/auth with the existing Bearer token attached. The DFX backend
   * attaches the new address to the active user, mirroring `@dfx.swiss/react`'s
   * `useAuth().authenticate()` flow.
   *
   * If the backend returns 409, the address already belongs to a different user
   * — that's a hard error and we surface it to the caller. Throughout, we keep
   * the original token in place so the user stays signed in as their primary
   * address regardless of the response.
   */
  async linkAddress(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<void> {
    const previousToken = this.accessToken;
    if (!previousToken) {
      throw new Error('Not authenticated — sign in before linking another address.');
    }

    const { message } = await this.getSignMessage(address);
    const signature = await signFn(message);

    try {
      await dfxApi.post<AuthResponseDto>('/v1/auth', {
        address,
        signature,
        wallet: options?.wallet ?? 'DFX Wallet',
        ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
      });
    } finally {
      this.accessToken = previousToken;
      dfxApi.setAuthToken(previousToken);
    }
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
