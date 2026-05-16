import { ldsApi } from './api';

/**
 * Static challenge that LDS signs on behalf of the user. The wallet signs
 * this exact string with its native-SegWit Bitcoin key; LDS verifies the
 * signature, mints a JWT, and remembers the binding between the SegWit
 * address and the Lightning identity.
 */
const buildAuthMessage = (address: string): string =>
  `By_signing_this_message,_you_confirm_to_lightning.space_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_${address}`;

export type LdsAsset = {
  name: 'BTC' | 'CHF' | 'USD' | 'EUC';
  displayName: string;
  status: 'Active' | 'ComingSoon';
  description?: string;
};

export type LdsLnWallet = {
  asset: LdsAsset;
  lndhubAdminUrl?: string;
  lndhubInvoiceUrl?: string;
};

export type LdsLnInfo = {
  /** The Lightning Address, e.g. `joshua@dfx.swiss`. */
  address: string;
  /** lnurlp encoding of the address, used to render QR codes. */
  addressLnurl: string;
  /** Signature LDS produces over the user's identity — DFX uses this when
   *  registering the Lightning blockchain on the user's account. */
  addressOwnershipProof: string;
  wallets: LdsLnWallet[];
};

export type LdsUser = {
  /** The Bitcoin (SegWit) address the user signed in with. */
  address: string;
  lightning: LdsLnInfo;
};

export class LdsService {
  /** The user, cached after first successful sign-in this app session. */
  private cachedUser: LdsUser | null = null;

  /**
   * Full LDS sign-in: sign the static ownership message with the BTC SegWit
   * wallet, exchange for a JWT, then fetch the user's LN identity. The
   * result is cached in-memory so subsequent calls reuse it without
   * re-prompting for a signature.
   */
  async getUser(
    address: string,
    signMessage: (message: string) => Promise<string>,
  ): Promise<LdsUser> {
    if (this.cachedUser && this.cachedUser.address === address) {
      return this.cachedUser;
    }

    const signature = await signMessage(buildAuthMessage(address));
    const session = await ldsApi.post<{ accessToken: string }>('auth', {
      address,
      signature,
      wallet: 'DFX Bitcoin',
    });

    ldsApi.setAuthToken(session.accessToken);

    const user = await ldsApi.get<LdsUser>('user');
    this.cachedUser = user;
    return user;
  }

  reset(): void {
    this.cachedUser = null;
    ldsApi.clearAuthToken();
  }
}

export const ldsService = new LdsService();
