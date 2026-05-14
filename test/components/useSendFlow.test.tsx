import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendFlow } from '../../src/hooks/useSendFlow';

// `useAccount` and `useRefreshBalance` are the only WDK touchpoints the hook
// has — both are stubbed here so the test never reaches a Bare worklet or a
// real RPC. The mock factory is hoisted by jest above the import order.
const mockSend = jest.fn();
const mockEstimateFee = jest.fn();
const mockRefreshWdkMutate = jest.fn();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: jest.fn(() => ({
    send: mockSend,
    estimateFee: mockEstimateFee,
  })),
  useRefreshBalance: jest.fn(() => ({
    mutate: mockRefreshWdkMutate,
  })),
}));

// Minimal IAsset stand-in. Only `getDecimals()` is exercised by the hook;
// `getId()` is included because the WDK type checks it at compile time even
// though our mock `send` never looks at the actual instance.
const fakeAsset = {
  getId: () => 'usdt-eth',
  getDecimals: () => 6,
} as unknown as Parameters<ReturnType<typeof useSendFlow>['send']>[0]['asset'];

function wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSendFlow', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockEstimateFee.mockReset();
    mockRefreshWdkMutate.mockReset();
  });

  describe('send', () => {
    it('rejects a zero amount without touching the WDK send method', async () => {
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let txHash: string | null = '';
      await act(async () => {
        txHash = await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '0' });
      });

      expect(txHash).toBeNull();
      expect(result.current.error).toBe('Amount must be greater than zero');
      expect(result.current.txHash).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns the tx hash and refreshes balances on a successful send', async () => {
      mockSend.mockResolvedValueOnce({ success: true, hash: '0xdeadbeef' });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let txHash: string | null = null;
      await act(async () => {
        txHash = await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(txHash).toBe('0xdeadbeef');
      expect(result.current.txHash).toBe('0xdeadbeef');
      expect(result.current.error).toBeNull();
      // 1 USDT with 6 decimals → "1000000" in base units.
      expect(mockSend).toHaveBeenCalledWith({
        asset: fakeAsset,
        to: '0xabc',
        amount: '1000000',
      });
      expect(mockRefreshWdkMutate).toHaveBeenCalledWith({ accountIndex: 0, type: 'wallet' });
    });

    it('propagates a failure result from WDK as an error state', async () => {
      mockSend.mockResolvedValueOnce({ success: false, error: 'insufficient funds' });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let txHash: string | null = null;
      await act(async () => {
        txHash = await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(txHash).toBeNull();
      expect(result.current.error).toBe('insufficient funds');
      expect(result.current.txHash).toBeNull();
      // Refresh must not fire on a failed send — stale-cache fallback
      // is fine; touching the cache would mask the real on-chain state.
      expect(mockRefreshWdkMutate).not.toHaveBeenCalled();
    });

    it('falls back to a generic message when the WDK failure carries no error string', async () => {
      mockSend.mockResolvedValueOnce({ success: false });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      await act(async () => {
        await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(result.current.error).toBe('Transaction failed');
    });

    it('catches a thrown error and exposes its message', async () => {
      mockSend.mockRejectedValueOnce(new Error('network down'));
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let txHash: string | null = '';
      await act(async () => {
        txHash = await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(txHash).toBeNull();
      expect(result.current.error).toBe('network down');
    });

    it('uses a generic message when the thrown value is not an Error instance', async () => {
      mockSend.mockRejectedValueOnce('boom');
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      await act(async () => {
        await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(result.current.error).toBe('Transaction failed');
    });

    it('scales fractional amounts to the asset decimals before handing to WDK', async () => {
      mockSend.mockResolvedValueOnce({ success: true, hash: '0xfeed' });
      const eighteenDecAsset = { getId: () => 'eth', getDecimals: () => 18 } as unknown as Parameters<
        typeof result.current.send
      >[0]['asset'];
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      await act(async () => {
        await result.current.send({ asset: eighteenDecAsset, to: '0xabc', amount: '0.5' });
      });

      expect(mockSend).toHaveBeenCalledWith({
        asset: eighteenDecAsset,
        to: '0xabc',
        amount: '500000000000000000',
      });
    });
  });

  describe('estimate', () => {
    it('rejects a zero amount with the amount-zero sentinel', async () => {
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
      await act(async () => {
        fee = await result.current.estimate({ asset: fakeAsset, to: '0xabc', amount: '0' });
      });

      expect(fee).toEqual({ success: false, error: 'amount-zero' });
      expect(mockEstimateFee).not.toHaveBeenCalled();
    });

    it('returns the fee on a successful estimate', async () => {
      mockEstimateFee.mockResolvedValueOnce({ success: true, fee: '21000000000000' });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
      await act(async () => {
        fee = await result.current.estimate({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(fee).toEqual({ success: true, fee: '21000000000000' });
    });

    it('propagates a failure result from estimateFee', async () => {
      mockEstimateFee.mockResolvedValueOnce({ success: false, error: 'rpc-error' });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
      await act(async () => {
        fee = await result.current.estimate({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(fee).toEqual({ success: false, error: 'rpc-error' });
    });

    it('catches a thrown estimate error', async () => {
      mockEstimateFee.mockRejectedValueOnce(new Error('node unreachable'));
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
      await act(async () => {
        fee = await result.current.estimate({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });

      expect(fee).toEqual({ success: false, error: 'node unreachable' });
    });
  });

  describe('reset', () => {
    it('clears txHash and error after a finished send', async () => {
      mockSend.mockResolvedValueOnce({ success: true, hash: '0xabc' });
      const { result } = renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

      await act(async () => {
        await result.current.send({ asset: fakeAsset, to: '0xabc', amount: '1' });
      });
      expect(result.current.txHash).toBe('0xabc');

      act(() => {
        result.current.reset();
      });

      expect(result.current.txHash).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
