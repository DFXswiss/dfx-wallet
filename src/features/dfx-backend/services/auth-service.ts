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
 * (5-minute TTL, evicted on session replacement) so a stale challenge can never be
 * replayed past its server-side expiry.
 */
const SIGNATURE_TTL_MS = 5 * 60 * 1000;
const SIGN_MESSAGE_PREFIX =
  'By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_';
type SignatureCacheEntry = { message: string; signature: string; ts: number };

/**
 * `generation` / `mutationAfterBegin` are the service-level flow counters
 * (latest-started flow wins). `apiGeneration` is `dfxApi.getAuthGeneration()`
 * captured after any clear in this flow. `cleared` is true only when this
 * flow itself called `clearAuthToken`, so a rollback writes the API token
 * only for that case.
 */
type AuthFlow = {
  generation: number;
  mutationAfterBegin: number;
  apiGeneration: number;
  cleared: boolean;
};

type LoginOptions = { wallet?: string; blockchain?: string; usedRef?: string };

export class DfxAuthFlowInvalidatedError extends Error {
  constructor() {
    super('DFX authentication was invalidated by a session change');
    this.name = 'DfxAuthFlowInvalidatedError';
  }
}

export class DfxSignMessageMismatchError extends Error {
  constructor() {
    super('DFX sign-message challenge does not match the requested address');
    this.name = 'DfxSignMessageMismatchError';
  }
}

export function assertBackendSignMessage(message: string, address: string): void {
  if (message !== `${SIGN_MESSAGE_PREFIX}${address}`) {
    throw new DfxSignMessageMismatchError();
  }
}

export class DfxAuthService {
  private accessToken: string | null = null;
  private generation = 0;
  private mutation = 0;
  private signatureCache: Map<string, SignatureCacheEntry> = new Map();

  /**
   * Start an authentication flow and capture its session ownership. Only
   * `logout` and `adoptStoredToken` bump the generation because they replace
   * the session from outside a flow. Every flow bumps the mutation counter so
   * only the latest-started flow remains eligible to install a token.
   * The API generation is read after a clear, so the flow adopts against the
   * generation it actually started on.
   */
  private beginFlow(clearToken = false): AuthFlow {
    this.mutation += 1;
    if (clearToken) {
      this.accessToken = null;
      dfxApi.clearAuthToken();
    }
    return {
      generation: this.generation,
      mutationAfterBegin: this.mutation,
      apiGeneration: dfxApi.getAuthGeneration(),
      cleared: clearToken,
    };
  }

  /**
   * Install a token only while this remains the latest-started flow and the
   * API generation it captured is still current. Counters are checked first:
   * a stale flow must not call `setAuthTokenIfCurrent`.
   */
  private installToken(token: string, flow: AuthFlow): void {
    if (flow.generation !== this.generation || flow.mutationAfterBegin !== this.mutation) {
      throw new DfxAuthFlowInvalidatedError();
    }
    if (!dfxApi.setAuthTokenIfCurrent(token, flow.apiGeneration)) {
      throw new DfxAuthFlowInvalidatedError();
    }
    this.accessToken = token;
    this.mutation += 1;
  }

  /**
   * Restore a token only while both the flow counters and the API generation
   * are unchanged. The API token is written only when this flow cleared it.
   */
  private rollbackToken(previousToken: string | null, flow: AuthFlow): void {
    if (flow.generation !== this.generation || flow.mutationAfterBegin !== this.mutation) {
      return;
    }
    if (dfxApi.getAuthGeneration() !== flow.apiGeneration) {
      return;
    }
    this.accessToken = previousToken;
    this.mutation += 1;
    if (!flow.cleared) return;
    if (previousToken) {
      dfxApi.setAuthToken(previousToken);
    } else {
      dfxApi.clearAuthToken();
    }
  }

  private async requestAuthToken(request: AuthRequestDto): Promise<string> {
    const response = await dfxApi.post<AuthResponseDto>('/v1/auth', request, { anonymous: true });
    return response.accessToken;
  }

  private flowStillCurrent(flow: AuthFlow): boolean {
    return (
      flow.generation === this.generation &&
      flow.mutationAfterBegin === this.mutation &&
      dfxApi.getAuthGeneration() === flow.apiGeneration
    );
  }

  /**
   * Adopt a JWT that was rehydrated from secure storage on cold start. The
   * boot path stores the token in `dfxApi` directly to keep authenticated
   * requests working, but `linkAddress` and `isAuthenticated` rely on this
   * service's own copy of the token. Without this sync the very first
   * post-boot link attempt threw "Not authenticated". This external token
   * replacement bumps the generation so older flows cannot overwrite it.
   */
  adoptStoredToken(token: string | null): void {
    this.accessToken = token;
    this.generation += 1;
    this.mutation += 1;
    this.signatureCache.clear();
  }

  /** Get the sign message challenge for an address */
  async getSignMessage(address: string): Promise<SignMessageDto> {
    return dfxApi.get<SignMessageDto>(
      `/v1/auth/signMessage?address=${encodeURIComponent(address)}`,
    );
  }

  /**
   * Authenticate with a signed message and get a JWT. The post carries no Bearer.
   * The token is adopted only while this flow is still the latest one and the
   * API generation it captured is still current.
   */
  async authenticate(request: AuthRequestDto): Promise<string> {
    const flow = this.beginFlow();
    const token = await this.requestAuthToken(request);
    this.installToken(token, flow);
    return token;
  }

  /**
   * Sign `message` for `address`, reusing a cached signature when possible.
   * If the cache has a signature for the same exact challenge string and
   * it's still inside TTL, return it without invoking signFn. Otherwise
   * sign fresh and update the cache if the session generation is unchanged.
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
    const generation = this.generation;
    const signature = await signFn(message);
    if (generation === this.generation) {
      this.signatureCache.set(address, { message, signature, ts: Date.now() });
    }
    return signature;
  }

  /**
   * 401 refresh. Uses the generation-bound API setters and does not start a
   * flow: `clearAuthToken` / `setAuthToken` would bump the API generation and
   * the in-flight request that triggered the refresh would not retry.
   */
  private async loginForRefresh(
    address: string,
    signFn: (message: string) => Promise<string>,
    options: LoginOptions | undefined,
    authGeneration: number,
  ): Promise<string> {
    const previousToken = this.accessToken;
    if (!dfxApi.clearAuthTokenForRefresh(authGeneration)) {
      throw new Error('Authentication changed before token refresh started.');
    }
    // accessToken stays set. The api token is restored only while this
    // snapshot is still current.
    const sessionAfterClear = this.accessToken;

    try {
      const { message } = await this.getSignMessage(address);
      assertBackendSignMessage(message, address);
      const signature = await this.signWithCache(address, message, signFn);
      const token = await this.requestAuthToken({
        address,
        signature,
        wallet: options?.wallet ?? 'DFX Wallet',
        ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
        ...(options?.usedRef !== undefined ? { usedRef: options.usedRef } : {}),
      });
      if (!dfxApi.setAuthTokenForRefresh(token, authGeneration)) {
        throw new Error('Authentication changed while token refresh was pending.');
      }
      this.accessToken = token;
      return token;
    } catch (err) {
      if (this.accessToken === sessionAfterClear && previousToken) {
        dfxApi.setAuthTokenForRefresh(previousToken, authGeneration);
      }
      throw err;
    }
  }

  /** Full auth flow: get challenge, sign, exchange for token */
  async login(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: LoginOptions,
    authGeneration?: number,
  ): Promise<string> {
    if (authGeneration !== undefined) {
      return this.loginForRefresh(address, signFn, options, authGeneration);
    }

    const previousToken = this.accessToken;
    const flow = this.beginFlow(true);

    try {
      const { message } = await this.getSignMessage(address);
      assertBackendSignMessage(message, address);
      const signature = await this.signWithCache(address, message, signFn);
      const token = await this.requestAuthToken({
        address,
        signature,
        wallet: options?.wallet ?? 'DFX Wallet',
        ...(options?.blockchain !== undefined ? { blockchain: options.blockchain } : {}),
        ...(options?.usedRef !== undefined ? { usedRef: options.usedRef } : {}),
      });
      this.installToken(token, flow);
      return token;
    } catch (err) {
      this.rollbackToken(previousToken, flow);
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
   * On failure the session is left unchanged, because this call does not
   * clear the token and only adopts a successful response while its flow
   * is still current. The POST requires the Bearer this call started with,
   * so a refresh cannot send it unauthenticated.
   */
  async changeActiveAddress(address: string): Promise<string> {
    const previousToken = this.accessToken;
    if (!previousToken) {
      throw new Error('Not authenticated — sign in before switching addresses.');
    }
    const flow = this.beginFlow();
    try {
      const response = await dfxApi.post<AuthResponseDto>(
        '/v1/user/change',
        { address },
        { requireAuth: true },
      );
      this.installToken(response.accessToken, flow);
      return response.accessToken;
    } catch (err) {
      this.rollbackToken(previousToken, flow);
      throw err;
    }
  }

  /**
   * LNURL counterpart to `loginAsAddressOwner`. Used when `linkLnurlAddress`
   * returns 409 — the LDS LNURL belongs to another DFX user, so we drop the
   * current Bearer and post /v1/auth with just the LNURL credentials. DFX
   * issues a fresh JWT for the address-owner; we adopt it.
   *
   * The session is cleared before the request. A failure restores the
   * previous token only while this flow's counters and API generation are
   * still unchanged. The post carries no Bearer.
   */
  async loginAsLnurlAddressOwner(
    lnurl: string,
    ownershipProof: string,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    const previousToken = this.accessToken;
    const flow = this.beginFlow(true);
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
      this.installToken(response.accessToken, flow);
      return response.accessToken;
    } catch (err) {
      this.rollbackToken(previousToken, flow);
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
   * Exchange the email confirmation otp for an access token. The new token is
   * adopted only while this call's flow and API generation are still current.
   *
   * This is a login, same as the other sign-in calls. It sends no
   * Authorization header, so a standing Bearer cannot ride along on the
   * OTP exchange.
   */
  async confirmMailLogin(otp: string): Promise<string> {
    const flow = this.beginFlow();
    const response = await dfxApi.get<{ accessToken: string; kycHash?: string }>(
      `/v1/auth/mail/confirm?code=${encodeURIComponent(otp)}`,
      { anonymous: true },
    );
    this.installToken(response.accessToken, flow);
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
   * the call does not clear the token and only adopts a successful response
   * while its flow is still current.
   *
   * The POST requires the Bearer this call started with. Without it, DFX
   * treats `/v1/auth` as a login of the LNURL instead of a link.
   */
  async linkLnurlAddress(
    lnurl: string,
    ownershipProof: string,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    const previousToken = this.accessToken;
    if (!previousToken) {
      throw new Error('Not authenticated — sign in before linking another address.');
    }
    const flow = this.beginFlow();
    try {
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
      this.installToken(response.accessToken, flow);
      return response.accessToken;
    } catch (err) {
      this.rollbackToken(previousToken, flow);
      throw err;
    }
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
   * On failure the session is left unchanged, because the call does not clear
   * the token and only adopts a successful response while its flow is still
   * current.
   *
   * The POST requires the Bearer this call started with. Without it, DFX
   * treats `/v1/auth` as a login of the new address instead of a merge.
   * A session change during signing skips the POST.
   */
  async linkAddress(
    address: string,
    signFn: (message: string) => Promise<string>,
    options?: { wallet?: string; blockchain?: string },
  ): Promise<string> {
    const previousToken = this.accessToken;
    if (!previousToken) {
      throw new Error('Not authenticated — sign in before linking another address.');
    }
    const flow = this.beginFlow();

    try {
      const { message } = await this.getSignMessage(address);
      assertBackendSignMessage(message, address);
      const signature = await this.signWithCache(address, message, signFn);
      if (!this.flowStillCurrent(flow)) {
        throw new DfxAuthFlowInvalidatedError();
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
      this.installToken(response.accessToken, flow);
      return response.accessToken;
    } catch (err) {
      this.rollbackToken(previousToken, flow);
      throw err;
    }
  }

  /** Clear auth state, invalidate older flows, and forget any cached signatures. */
  logout(): void {
    this.accessToken = null;
    this.generation += 1;
    this.mutation += 1;
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
