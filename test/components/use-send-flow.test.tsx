/**
 * Deep behavioural coverage for `useSendFlow` beyond the happy-path file in
 * `useSendFlow.test.tsx`. Focus areas the threat model cares about for a send
 * flow:
 *   - amount parsing / precision: dust that truncates to zero, fractional
 *     digits beyond the asset's decimals, junk input, scientific notation;
 *   - the loading state machine (isLoading transitions, error clearing);
 *   - that a failed/zero send never refreshes balances (no cache write that
 *     could mask the real on-chain state);
 *   - estimate vs send sharing the same base-unit scaling;
 *   - accountIndex propagation into the balance refresh.
 *
 * WDK is mocked via the same pattern as the sibling test: only `useAccount`
 * and `useRefreshBalance` are touched by the hook.
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendFlow } from '../../src/hooks/useSendFlow';

const mockSend = jest.fn();
const mockEstimateFee = jest.fn();
const mockRefreshWdkMutate = jest.fn();
const mockUseAccount = jest.fn(() => ({ send: mockSend, estimateFee: mockEstimateFee }));

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: (...args: unknown[]) => mockUseAccount(...(args as [])),
  useRefreshBalance: jest.fn(() => ({ mutate: mockRefreshWdkMutate })),
}));

type SendParams = Parameters<ReturnType<typeof useSendFlow>['send']>[0];
type Asset = SendParams['asset'];

const assetWithDecimals = (decimals: number, id = 'asset'): Asset =>
  ({ getId: () => id, getDecimals: () => decimals }) as unknown as Asset;

const usdt = assetWithDecimals(6, 'usdt-eth');
const eth = assetWithDecimals(18, 'eth');

function wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const render = () => renderHook(() => useSendFlow('ethereum'), { wrapper: wrap });

beforeEach(() => {
  mockSend.mockReset();
  mockEstimateFee.mockReset();
  mockRefreshWdkMutate.mockReset();
  mockUseAccount.mockClear();
});

describe('useSendFlow — amount parsing / precision (send path)', () => {
  // Each of these display strings scales to base-unit "0" via parseUnits, so
  // the send must short-circuit as "greater than zero" WITHOUT calling WDK.
  it.each([
    ['dust truncated below one base unit', '0.0000001', 6],
    ['exact zero', '0', 6],
    ['zero with fraction', '0.0', 18],
    ['empty string', '', 6],
    ['bare dot', '.', 6],
    ['negative (rejected by the numeric regex)', '-1', 6],
    ['scientific notation (unsupported → 0)', '1e3', 6],
    ['double decimal point', '1.5.5', 6],
    ['comma decimal separator', '1,5', 6],
    ['non-numeric junk', 'abc', 6],
  ])('rejects %s as zero without touching WDK', async (_label, amount, decimals) => {
    const asset = assetWithDecimals(decimals);
    const { result } = render();

    let txHash: string | null = 'sentinel';
    await act(async () => {
      txHash = await result.current.send({ asset, to: '0xabc', amount });
    });

    expect(txHash).toBeNull();
    expect(result.current.error).toBe('Amount must be greater than zero');
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRefreshWdkMutate).not.toHaveBeenCalled();
  });

  it('truncates fractional digits beyond the asset decimals (no rounding)', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0x1' });
    const { result } = render();

    await act(async () => {
      // 1.2345678 at 6 decimals → drops the 8th digit → 1234567 base units.
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1.2345678' });
    });

    expect(mockSend).toHaveBeenCalledWith({ asset: usdt, to: '0xabc', amount: '1234567' });
  });

  it('sends the smallest representable unit (1 wei-equivalent) when it survives truncation', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0x1' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '0.000001' });
    });

    expect(mockSend).toHaveBeenCalledWith({ asset: usdt, to: '0xabc', amount: '1' });
  });

  it('handles full 18-decimal precision without float drift', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0x1' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: eth, to: '0xabc', amount: '1.999999999999999999' });
    });

    expect(mockSend).toHaveBeenCalledWith({
      asset: eth,
      to: '0xabc',
      amount: '1999999999999999999',
    });
  });

  it('tolerates surrounding whitespace in the amount', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0x1' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '  1  ' });
    });

    expect(mockSend).toHaveBeenCalledWith({ asset: usdt, to: '0xabc', amount: '1000000' });
  });
});

describe('useSendFlow — loading + state machine', () => {
  it('clears a previous error when a new send starts', async () => {
    const { result } = render();

    // First send fails (zero amount) → error is set.
    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '0' });
    });
    expect(result.current.error).toBe('Amount must be greater than zero');

    // Second send succeeds → error must be cleared.
    mockSend.mockResolvedValueOnce({ success: true, hash: '0xok' });
    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(result.current.error).toBeNull();
    expect(result.current.txHash).toBe('0xok');
  });

  it('exposes isLoading=true while the send is in flight and false after', async () => {
    let resolveSend: (v: { success: true; hash: string }) => void = () => undefined;
    mockSend.mockReturnValueOnce(
      new Promise<{ success: true; hash: string }>((res) => {
        resolveSend = res;
      }),
    );
    const { result } = render();

    let pending!: Promise<string | null>;
    act(() => {
      pending = result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    // Mid-flight: the optimistic loading flag is set.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.txHash).toBeNull();

    await act(async () => {
      resolveSend({ success: true, hash: '0xfin' });
      await pending;
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.txHash).toBe('0xfin');
  });

  it('leaves isLoading=false and an error set after a thrown send', async () => {
    mockSend.mockRejectedValueOnce(new Error('rpc boom'));
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('rpc boom');
    expect(result.current.txHash).toBeNull();
  });
});

describe('useSendFlow — balance refresh discipline', () => {
  it('refreshes balances for account 0 ONLY on a successful send', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0xok' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(mockRefreshWdkMutate).toHaveBeenCalledTimes(1);
    expect(mockRefreshWdkMutate).toHaveBeenCalledWith({ accountIndex: 0, type: 'wallet' });
  });

  it('does not refresh after a WDK failure result', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'insufficient funds' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(mockRefreshWdkMutate).not.toHaveBeenCalled();
  });

  it('does not refresh after a thrown send', async () => {
    mockSend.mockRejectedValueOnce(new Error('down'));
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(mockRefreshWdkMutate).not.toHaveBeenCalled();
  });
});

describe('useSendFlow — estimate path shares scaling + parsing', () => {
  it('scales the estimate amount with the same base-unit logic as send', async () => {
    mockEstimateFee.mockResolvedValueOnce({ success: true, fee: '21000' });
    const { result } = render();

    await act(async () => {
      await result.current.estimate({ asset: eth, to: '0xabc', amount: '0.5' });
    });
    expect(mockEstimateFee).toHaveBeenCalledWith({
      asset: eth,
      to: '0xabc',
      amount: '500000000000000000',
    });
  });

  it('returns the amount-zero sentinel for dust that truncates to zero', async () => {
    const { result } = render();

    let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
    await act(async () => {
      fee = await result.current.estimate({ asset: usdt, to: '0xabc', amount: '0.0000001' });
    });
    expect(fee).toEqual({ success: false, error: 'amount-zero' });
    expect(mockEstimateFee).not.toHaveBeenCalled();
  });

  it('returns the amount-zero sentinel for junk input', async () => {
    const { result } = render();

    let fee: Awaited<ReturnType<typeof result.current.estimate>> | undefined;
    await act(async () => {
      fee = await result.current.estimate({ asset: usdt, to: '0xabc', amount: 'not-a-number' });
    });
    expect(fee).toEqual({ success: false, error: 'amount-zero' });
    expect(mockEstimateFee).not.toHaveBeenCalled();
  });

  it('does not mutate send state — estimate is read-only', async () => {
    mockEstimateFee.mockResolvedValueOnce({ success: false, error: 'rpc-error' });
    const { result } = render();

    await act(async () => {
      await result.current.estimate({ asset: usdt, to: '0xabc', amount: '1' });
    });
    // estimate must not leak its failure into the send-flow error surface.
    expect(result.current.error).toBeNull();
    expect(result.current.txHash).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useSendFlow — account binding', () => {
  it('binds useAccount to the chain passed in with accountIndex 0', () => {
    render();
    expect(mockUseAccount).toHaveBeenCalledWith({ network: 'ethereum', accountIndex: 0 });
  });

  it('re-binds when the chain changes', () => {
    const { rerender } = renderHook((chain: Parameters<typeof useSendFlow>[0]) => useSendFlow(chain), {
      wrapper: wrap,
      initialProps: 'ethereum' as Parameters<typeof useSendFlow>[0],
    });
    rerender('polygon');
    expect(mockUseAccount).toHaveBeenLastCalledWith({ network: 'polygon', accountIndex: 0 });
  });
});

describe('useSendFlow — reset', () => {
  it('returns the state machine to its initial idle shape', async () => {
    mockSend.mockResolvedValueOnce({ success: true, hash: '0xabc' });
    const { result } = render();

    await act(async () => {
      await result.current.send({ asset: usdt, to: '0xabc', amount: '1' });
    });
    expect(result.current.txHash).toBe('0xabc');

    act(() => {
      result.current.reset();
    });
    expect(result.current).toMatchObject({ isLoading: false, txHash: null, error: null });
  });
});
