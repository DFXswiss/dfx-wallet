import { useCallback, useState } from 'react';
import { useAccount, type IAsset } from '@tetherto/wdk-react-native-core';
import { useTranslation } from 'react-i18next';
import type { ChainId } from '@/config/chains';
import { parseUnits } from '@/config/portfolio-presentation';
import { getAssetMeta, getSendAssetForCanonical } from '@/config/tokens';
import { useRefreshBalances } from '@/services/balances';
import { isBitcoinOnChainAddress } from '@/services/bitcoin-address';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

/**
 * Hook for sending an asset (native or ERC-20) via the WDK worklet.
 *
 * The send screen surfaces canonical symbols (USD/CHF/EUR/BTC) so the caller
 * resolves the actual `IAsset` (e.g. USDT-on-Polygon) and passes it in. The
 * user-typed display amount ("1", "0.5") is scaled here by the asset's
 * decimals before being handed to WDK, which expects amounts in the asset's
 * smallest unit.
 */
export type FeeEstimate = { success: true; fee: string } | { success: false; error: string };

export function sendErrorKey(rawError: string | undefined): string {
  const error = rawError?.toLowerCase() ?? '';
  if (/insufficient|not enough|exceeds balance|balance too low/.test(error)) {
    return 'send.error.insufficientFunds';
  }
  if (/amount.*(zero|positive|greater)|greater than zero/.test(error)) {
    return 'send.error.amountZero';
  }
  if (/fee.*(high|exceed)|max.*fee/.test(error)) return 'send.error.feeTooHigh';
  if (/network|timeout|timed out|offline|fetch|socket|rpc|unreachable/.test(error)) {
    return 'send.error.network';
  }
  return 'send.error.generic';
}

export function useSendFlow(chain: ChainId) {
  const { t } = useTranslation();
  const selectedAccount = useAccount({
    network: chain,
    accountIndex: 0,
  });
  const bitcoinAccount = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const refreshBalances = useRefreshBalances();
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { asset: IAsset; to: string; amount: string }) => {
      setState({ isLoading: true, txHash: null, error: null });

      try {
        const baseAmount = parseUnits(params.amount, params.asset.getDecimals());
        if (baseAmount === '0') {
          const msg = t('send.error.amountZero');
          setState({ isLoading: false, txHash: null, error: msg });
          return null;
        }

        const isBitcoinOnChain =
          getAssetMeta(params.asset.getId())?.canonicalSymbol === 'BTC' &&
          isBitcoinOnChainAddress(params.to);
        const account = isBitcoinOnChain ? bitcoinAccount : selectedAccount;
        const asset = isBitcoinOnChain
          ? (getSendAssetForCanonical('BTC', 'bitcoin') ?? params.asset)
          : params.asset;
        const result = await account.send({
          asset,
          to: params.to,
          amount: baseAmount,
        });

        if (!result.success) {
          console.warn('Wallet send failed', result.error);
          const msg = t(sendErrorKey(result.error));
          setState({ isLoading: false, txHash: null, error: msg });
          return null;
        }

        setState({ isLoading: false, txHash: result.hash, error: null });
        refreshBalances(0);
        return result.hash;
      } catch (err) {
        const rawError = err instanceof Error ? err.message : undefined;
        console.warn('Wallet send failed', err);
        const msg = t(sendErrorKey(rawError));
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [bitcoinAccount, selectedAccount, refreshBalances, t],
  );

  const estimate = useCallback(
    async (params: { asset: IAsset; to: string; amount: string }): Promise<FeeEstimate> => {
      try {
        const baseAmount = parseUnits(params.amount, params.asset.getDecimals());
        if (baseAmount === '0') {
          return { success: false, error: t('send.error.amountZero') };
        }
        const isBitcoinOnChain =
          getAssetMeta(params.asset.getId())?.canonicalSymbol === 'BTC' &&
          isBitcoinOnChainAddress(params.to);
        const account = isBitcoinOnChain ? bitcoinAccount : selectedAccount;
        const asset = isBitcoinOnChain
          ? (getSendAssetForCanonical('BTC', 'bitcoin') ?? params.asset)
          : params.asset;
        const result = await account.estimateFee({
          asset,
          to: params.to,
          amount: baseAmount,
        });
        if (!result.success) {
          console.warn('Wallet fee estimate failed', result.error);
          return { success: false, error: t(sendErrorKey(result.error)) };
        }
        return { success: true, fee: result.fee };
      } catch (err) {
        const rawError = err instanceof Error ? err.message : undefined;
        console.warn('Wallet fee estimate failed', err);
        return {
          success: false,
          error: t(sendErrorKey(rawError)),
        };
      }
    },
    [bitcoinAccount, selectedAccount, t],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, estimate, reset };
}
