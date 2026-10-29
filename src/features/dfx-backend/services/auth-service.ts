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

/**
 * In-memory cache of recent (address, message) → signature tuples. We
 * sometimes call /v1/auth twice in quick succession for the same address
 * (linkAddress → 409 → loginAsAddressOwner re-auth). DFX' sign-message
 * challenges are stable for a few minutes, so reusing a fresh signature
 * skips redundant WDK-worklet round-trips and any biometric prompts a
 * hardware-wallet sign path would otherwise trigger.
 *
 * Mirrors realunit-app's `SessionCache.signature` pattern; kept tight
 * (5-minute TTL, evicted on logout) so a stale challenge can never be
 * replayed past its server-side expiry.
 */
const SIGNATURE_TTL_MS = 5 * 60 * 1000;
type SignatureCacheEntry = { message: string; signature: string; ts: number };

export class DfxAuthService {
  private accessToken: string | null = null;
  private signatureCache: Map<string, SignatureCacheEntry> = new Map();

  /**
   * Adopt a JWT that was rehydrated from secure storage on cold start. The
   * boot path stores the token in `dfxApi` directly to keep authenticated
   * requests working, but `linkAddress` and `isAuthenticated` rely on this
   * service's own copy of the token. Without this sync the very first
   * post-boot link attempt threw "Not authenticated".
   */
  adoptStoredToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Get the sign message challenge for an address */
  async getSignMessage(address: string): Promise<SignMessageDto> {
    return dfxApi.get<SignMessageDto>(
      `/v1/auth/signMessage?address=${encodeURIComponent(address)}`,
    );
  }

  /** Authenticate with a signed message and get a JWT. The post carries no Bearer. */
  async authenticate(request: AuthRequestDto, authGeneration?: number): Promise<string> {
    const response = await dfxApi.post<AuthResponseDto>('/v1/auth', request, { anonymous: true });
    if (
      authGeneration !== undefined &&
      !dfxApi.setAuthTokenForRefresh(response.accessToken, authGeneration)
    ) {
      throw new Error('Authentication changed while token refresh was pending.');
    }
    this.accessToken = response.accessToken;
    if (authGeneration === undefined) dfxApi.setAuthToken(response.accessToken);
    return response.accessToken;
  }

  /**
   * Sign `message` for `address`, reusing a cached signature when possible.
   * If the cache has a signature for the same exact challenge string and
   * it's still inside TTL, return it without invoking signFn. Otherwise
   * sign fresh and update the cache.
   */
  private async signWithCache(
    address: string,
    message: string,
    signFn: (message: string) => Promise<string>,
  ): Promise<string> {
    const cached = this.signatureCache.get(address);
    if (cached && cached.message === message && Date.now() - cached.ts < SIGNATURE_TTL_MS) {
      return cached.signature;
    }
    const signature = await signFn(message);
    this.signatureCache.set(address, { message, signature, ts: Date.now() });
    return signature;
  }

  /** Full auth flow: get challenge, sign, exchange for token */
  async login(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string; usedRef?: string },
    authGeneration?: number,
  ): Promise<string> {
    const previousToken = this.accessToken;
    if (authGeneration === undefined) {
      this.accessToken = null;
      dfxApi.clearAuthToken();
    } else if (!dfxApi.clearAuthTokenForRefresh(authGeneration)) {
      throw new Error('Authentication changed before token refresh started.');
    }
    // A fresh login nulls accessToken. A refresh leaves it and only clears the
    // api token. Restore only while that cleared state is still current.
    const sessionAfterClear = this.accessToken;

    try {
      const { message } = await this.getSignMessage(address);
      const signature = await this.signWithCache(address, message, signFn);

      return await this.authenticate(
        {
          address,
          signature,
          wallet: options?.wallet ?? 'DFX Wallet',
          ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
          ...(options?.usedRef !== undefined ? { usedRef: options.usedRef } : {}),
        },
        authGeneration,
      );
    } catch (err) {
      if (this.accessToken === sessionAfterClear) {
        if (authGeneration === undefined) {
          this.accessToken = previousToken;
          if (previousToken) dfxApi.setAuthToken(previousToken);
        } else if (previousToken) {
          dfxApi.setAuthTokenForRefresh(previousToken, authGeneration);
        }
      }
      throw err;
    }
  }

  /** Refresh auth token (re-sign challenge) */
  async refresh(
    address: string,
    signFn: (message: string) => Promise<string>,
    authGeneration?: number,
  ): Promise<string> {
    return this.login(address, signFn, undefined, authGeneration);
  }

  /**
   * Re-authenticate AS the owner of `address` instead of trying to merge it
   * into the current account. Used as a fallback when linkAddress returns
   * 409 "Address already linked to another account" — the WDK address is
   * already owned by a DFX user, just not the one our current JWT points to.
   * Posting /v1/auth without the existing Bearer makes DFX issue a fresh
   * JWT for the address-owner; we adopt it so the rest of the buy/sell
   * flow runs against that account.
   *
   * Net effect: dropping the prior session and walking forward with the
   * DFX user that already has this wallet attached, so /buy/quote stops
   * returning "Asset blockchain mismatch" and the linkChain modal stops
   * coming back with 409.
   */
  async loginAsAddressOwner(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    return this.login(address, signFn, options);
  }

  /**
   * Switch the active address for the *currently authenticated DFX user*
   * to another address that's already linked to the same account, without
   * re-signing.
   *
   * Mirrors the path app.dfx.swiss uses: POST /v1/user/change with the
   * target `address` in the body — the API verifies the address belongs
   * to the JWT's `userDataId` and returns a fresh JWT scoped to that
   * address. Downstream `/v1/buy/paymentInfos` then credits the chosen
   * wallet because the JWT's address claim is what DFX' route matcher
   * pivots on.
   *
   * Key difference from {@link loginAsAddressOwner}: no `signFn`. This
   * unlocks "buy into another linked wallet" for wallets we cannot sign
   * for locally (e.g. linked from another device) — the standing Bearer
   * already proves account ownership.
   *
   * On failure the session is left unchanged, because the call only adopts
   * the new token after a successful response. The POST requires the Bearer
   * this call started with, so a refresh cannot send it unauthenticated.
   * A successful response is adopted only while this call's session is still current.
   */
  async changeActiveAddress(address: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated — sign in before switching addresses.');
    }
    const generation = dfxApi.getAuthGeneration();
    const response = await dfxApi.post<AuthResponseDto>(
      '/v1/user/change',
      { address },
      { requireAuth: true },
    );
    if (!dfxApi.setAuthTokenIfCurrent(response.accessToken, generation)) {
      throw new Error('Session changed while switching addresses.');
    }
    this.accessToken = response.accessToken;
    return response.accessToken;
  }

  /**
   * LNURL counterpart to `loginAsAddressOwner`. Used when `linkLnurlAddress`
   * returns 409 — the LDS LNURL belongs to another DFX user, so we drop the
   * current Bearer and post /v1/auth with just the LNURL credentials. DFX
   * issues a fresh JWT for the address-owner; we adopt it.
   *
   * The session is cleared before the request. On failure the previous token
   * is restored only while that cleared state is still current, so a session
   * adopted in the meantime is left in place.
   */
  async loginAsLnurlAddressOwner(
    lnurl: string,
    ownershipProof: string,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    const previousToken = this.accessToken;
    this.accessToken = null;
    dfxApi.clearAuthToken();
    try {
      const response = await dfxApi.post<AuthResponseDto>(
        '/v1/auth',
        {
          address: lnurl.toUpperCase(),
          signature: ownershipProof,
          wallet: options?.wallet ?? 'DFX Bitcoin',
          ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
        },
        { anonymous: true },
      );
      this.accessToken = response.accessToken;
      dfxApi.setAuthToken(response.accessToken);
      return response.accessToken;
    } catch (err) {
      // accessToken was cleared before this request. Restore only if it is still cleared.
      if (this.accessToken === null) {
        this.accessToken = previousToken;
        if (previousToken) dfxApi.setAuthToken(previousToken);
      }
      throw err;
    }
  }

  /**
   * Trigger an email-based sign-in. The backend sends an email containing a
   * confirmation link with an `?otp=` token. The user pastes either the full
   * link or just the otp into the app, which we then exchange via
   * {@link confirmMailLogin} for a JWT.
   *
   * Mirrors `@dfx.swiss/react`'s `useAuth().signInWithMail`.
   *
   * The only caller signs the wallet in first: DFX binds the mail to that
   * session. The POST requires the Bearer. A refresh clears the api token
   * while the service token stays set; without `requireAuth` the mail would
   * go out with no session and bind to nothing.
   */
  async requestMailLogin(
    mail: string,
    options?: { redirectUri?: string; wallet?: string; recommendationCode?: string },
  ): Promise<void> {
    await dfxApi.post(
      '/v1/auth/mail',
      {
        mail,
        ...(options?.redirectUri !== undefined ? { redirectUri: options.redirectUri } : {}),
        ...(options?.wallet !== undefined ? { wallet: options.wallet } : {}),
        ...(options?.recommendationCode !== undefined
          ? { recommendationCode: options.recommendationCode }
          : {}),
      },
      { requireAuth: true },
    );
  }

  /**
   * Exchange the email confirmation otp for an access token. Sets the API
   * client to use the new token and returns it.
   *
   * This is a login, same as the other sign-in calls. It sends no
   * Authorization header, so a standing Bearer cannot ride along on the
   * OTP exchange.
   */
  async confirmMailLogin(otp: string): Promise<string> {
    const response = await dfxApi.get<{ accessToken: string; kycHash?: string }>(
      `/v1/auth/mail/confirm?code=${encodeURIComponent(otp)}`,
      { anonymous: true },
    );
    this.accessToken = response.accessToken;
    dfxApi.setAuthToken(response.accessToken);
    return response.accessToken;
  }

  /**
   * Link an LDS-managed Lightning identity to the active DFX account.
   *
   * Lightning auth at DFX skips the standard `/v1/auth/signMessage` challenge
   * step — instead the wallet sends the LNURL-encoded address along with the
   * static ownership proof LDS issued. We mirror DFX's own e2e auth helper
   * here (services/e2e/helpers/auth-cache.ts).
   *
   * Like `linkAddress`, the rotated JWT is adopted (now contains `Lightning`
   * in `user.blockchains`). On failure the session is left unchanged, because
   * the call only adopts the new token after a successful response.
   *
   * The POST requires the Bearer this call started with. Without it, DFX
   * treats `/v1/auth` as a login of the LNURL instead of a link.
   * A successful response is adopted only while this call's session is still current.
   */
  async linkLnurlAddress(
    lnurl: string,
    ownershipProof: string,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated — sign in before linking another address.');
    }
    const generation = dfxApi.getAuthGeneration();
    // DFX address validator requires uppercase LNURL: `(LNURL|LNDHUB)[A-Z0-9]{25,250}`.
    // LDS hands us the lowercase `lnurl1…` form, so without this the DTO
    // validator returns 400 before the signature is even checked.
    // The DFX e2e helper sends ONLY { address, signature } — no wallet/blockchain
    // hints (those keys are accepted but not used by the verifier).
    const response = await dfxApi.post<AuthResponseDto>(
      '/v1/auth',
      {
        address: lnurl.toUpperCase(),
        signature: ownershipProof,
        wallet: options?.wallet ?? 'DFX Bitcoin',
        ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
      },
      { requireAuth: true },
    );
    if (!dfxApi.setAuthTokenIfCurrent(response.accessToken, generation)) {
      throw new Error('Session changed while linking an address.');
    }
    this.accessToken = response.accessToken;
    return response.accessToken;
  }

  /**
   * Link a new wallet address to the currently authenticated DFX account and
   * return the freshly-issued JWT.
   *
   * Posts to /v1/auth with the existing Bearer token attached. The DFX backend
   * merges the new address into the active user and re-issues a JWT whose
   * `user.blockchains` claim now contains the freshly-linked chain. We swap
   * the new token in (both in-memory + on `dfxApi`) so the next /buy/quote
   * passes the asset/blockchain validation. The caller is responsible for
   * persisting the returned token to secure storage.
   *
   * On failure the session is left unchanged, because the call only adopts
   * the new token after a successful response.
   *
   * The POST requires the Bearer this call started with. Without it, DFX
   * treats `/v1/auth` as a login of the new address instead of a merge.
   * A successful response is adopted only while this call's session is still current, and a
   * session change during signing skips the POST.
   */
  async linkAddress(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated — sign in before linking another address.');
    }
    const generation = dfxApi.getAuthGeneration();

    const { message } = await this.getSignMessage(address);
    const signature = await this.signWithCache(address, message, signFn);
    if (dfxApi.getAuthGeneration() !== generation) {
      throw new Error('Session changed while linking an address.');
    }

    const response = await dfxApi.post<AuthResponseDto>(
      '/v1/auth',
      {
        address,
        signature,
        wallet: options?.wallet ?? 'DFX Wallet',
        ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
      },
      { requireAuth: true },
    );
    if (!dfxApi.setAuthTokenIfCurrent(response.accessToken, generation)) {
      throw new Error('Session changed while linking an address.');
    }
    this.accessToken = response.accessToken;
    return response.accessToken;
  }

  /** Clear auth state and forget any cached signatures. */
  logout(): void {
    this.accessToken = null;
    this.signatureCache.clear();
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
