import { useCallback } from 'react';
import type { ChainId } from '@/config/chains';
import { markChainLinkedInAutoLinkCache } from '@/hooks/useDfxAutoLink';
import { dfxAuthService, DfxApiError } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useTradeChainAccounts } from './useTradeChainAccounts';

type UseLinkChainToDfxParams = {
  /** Re-runs the call that triggered the linkChain gate after a successful link. */
  retryLast: () => void | Promise<void>;
};

/**
 * Shared linkChain recovery flow for Buy and Sell. Identical in both
 * screens before this module: attaches the wallet address (or, for
 * Taproot/Lightning, the DFX Lightning Address) to the current DFX user so
 * the next `getQuote`/`createPaymentInfo` call succeeds, then replays the
 * call that surfaced the gate.
 */
export function useLinkChainToDfx({ retryLast }: UseLinkChainToDfxParams) {
  const { btcAccount, sparkAccount, ethAccount, lds } = useTradeChainAccounts();

  const linkChainToDfx = useCallback(
    async (chain: ChainId) => {
      // Taproot + Lightning both ride the same DFX Lightning Network rails
      // (lightning.space-managed LDS user). The deposit address is a Lightning
      // Address (`name@dfx.swiss`) and we hand DFX the LNURL form plus the
      // ownership proof LDS issued instead of running a wallet sign-flow.
      if (chain === 'bitcoin-taproot' || chain === 'bitcoin-lightning') {
        const user = lds.user ?? (await lds.signIn());
        if (!user) {
          throw new Error('DFX Lightning wallet not ready — please retry.');
        }
        try {
          const ldsToken = await dfxAuthService.linkLnurlAddress(
            user.lightning.addressLnurl,
            user.lightning.addressOwnershipProof,
            { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
          );
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ldsToken);
          await markChainLinkedInAutoLinkCache('lightning');
          void retryLast();
        } catch (err) {
          // 409 → the LDS LNURL is on another DFX user. Mirror the EVM/BTC
          // recovery: drop the current JWT and re-auth as the LNURL owner
          // so the buy/sell flow can continue against the account that
          // already has Lightning attached.
          if (err instanceof DfxApiError && err.statusCode === 409) {
            const ownerToken = await dfxAuthService.loginAsLnurlAddressOwner(
              user.lightning.addressLnurl,
              user.lightning.addressOwnershipProof,
              { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
            );
            await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ownerToken);
            await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
            void retryLast();
            return;
          }
          throw err;
        }
        return;
      }

      const account =
        chain === 'bitcoin' ? btcAccount : chain === 'spark' ? sparkAccount : ethAccount;
      if (!account.address) {
        throw new Error(`Wallet for ${chain} not ready`);
      }
      const blockchainName =
        chain === 'bitcoin'
          ? 'Bitcoin'
          : chain === 'spark'
            ? 'Spark'
            : chain === 'arbitrum'
              ? 'Arbitrum'
              : chain === 'polygon'
                ? 'Polygon'
                : chain === 'base'
                  ? 'Base'
                  : 'Ethereum';
      const sign = async (message: string) => {
        const result = await account.sign(message);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to sign message');
        }
        return result.signature;
      };
      try {
        const newToken = await dfxAuthService.linkAddress(account.address, sign, {
          wallet: 'DFX Wallet',
          blockchain: blockchainName,
        });
        await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, newToken);
        // Mark in the auto-link cache so the next cold start skips this
        // chain instead of re-prompting. Only chains that auto-link knows
        // about: bitcoin + the EVM chains (ethereum is the login, no cache
        // entry needed).
        if (chain === 'bitcoin' || chain === 'arbitrum' || chain === 'polygon' || chain === 'base')
          await markChainLinkedInAutoLinkCache(chain);
        void retryLast();
      } catch (err) {
        // 409 means the address belongs to a *different* DFX user. The user's
        // mental model is "this is MY wallet" — so re-auth as the owner of
        // this address (drop the prior JWT) instead of forcing a merge that
        // DFX won't allow. The buy/sell flow then runs against the account
        // that already has the chain in `user.blockchains`, dodging both the
        // 409 and the next "Asset blockchain mismatch".
        if (err instanceof DfxApiError && err.statusCode === 409) {
          const ownerToken = await dfxAuthService.loginAsAddressOwner(account.address, sign, {
            wallet: 'DFX Wallet',
            blockchain: blockchainName,
          });
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, ownerToken);
          // Wipe the per-chain link cache: a different user means different
          // already-linked chains, so auto-link should re-evaluate from scratch.
          await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
          void retryLast();
          return;
        }
        throw err;
      }
    },
    [btcAccount, sparkAccount, ethAccount, lds, retryLast],
  );

  return { linkChainToDfx };
}
