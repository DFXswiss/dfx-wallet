import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';

const mockGetUser = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxUserService: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
}));

// eslint-disable-next-line import/first
import { useLinkedWalletProfile } from '@/features/portfolio/useLinkedWalletProfile';

const LINKED: UserAddressDto = {
  address: '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa',
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};

const ACTIVE: UserAddressDto = {
  address: '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb',
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function trackStateUpdates(): jest.Mock {
  const originalUseState = React.useState;
  const updates = jest.fn();
  jest.spyOn(React, 'useState').mockImplementation(
    ((initialState: unknown) => {
      const [state, setState] = originalUseState(initialState);
      const trackedSetState: React.Dispatch<React.SetStateAction<unknown>> = (value) => {
        updates(value);
        setState(value);
      };
      return [state, trackedSetState];
    }) as unknown as typeof React.useState,
  );
  return updates;
}

describe('useLinkedWalletProfile', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts incomplete for an authenticated user until getUser settles', () => {
    const request = deferred<unknown>();
    mockGetUser.mockReturnValue(request.promise);
    const renders: boolean[] = [];

    const { unmount } = renderHook(() => {
      const value = useLinkedWalletProfile(true);
      renders.push(value.isIncomplete);
      return value;
    });

    expect(renders[0]).toBe(true);
    expect(renders.every((isIncomplete) => isIncomplete)).toBe(true);
    unmount();
  });

  it('starts and stays complete for an unauthenticated user', () => {
    const renders: boolean[] = [];

    renderHook(() => {
      const value = useLinkedWalletProfile(false);
      renders.push(value.isIncomplete);
      return value;
    });

    expect(renders[0]).toBe(false);
    expect(renders.every((isIncomplete) => !isIncomplete)).toBe(true);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('publishes linked and active addresses after a successful load', async () => {
    mockGetUser.mockResolvedValue({ addresses: [LINKED, ACTIVE], activeAddress: ACTIVE });

    const { result } = renderHook(() => useLinkedWalletProfile(true));

    await waitFor(() => expect(result.current.isIncomplete).toBe(false));
    expect(result.current.linkedAddresses).toEqual([LINKED, ACTIVE]);
    expect(result.current.activeAddress).toBe(ACTIVE.address);
  });

  it(
    'keeps the last successful profile and marks it incomplete after a rejected refresh',
    async () => {
      mockGetUser.mockResolvedValueOnce({ addresses: [LINKED], activeAddress: ACTIVE });
      const { result, rerender } = renderHook(
        ({ refreshKey }: { refreshKey: number }) => useLinkedWalletProfile(true, refreshKey),
        { initialProps: { refreshKey: 0 } },
      );
      await waitFor(() => expect(result.current.isIncomplete).toBe(false));

      mockGetUser.mockRejectedValueOnce(new Error('offline'));
      rerender({ refreshKey: 1 });

      await waitFor(() => expect(result.current.isIncomplete).toBe(true));
      expect(result.current.linkedAddresses).toEqual([LINKED]);
      expect(result.current.activeAddress).toBe(ACTIVE.address);
    },
  );

  it('resets the profile on logout', async () => {
    mockGetUser.mockResolvedValue({ addresses: [LINKED], activeAddress: ACTIVE });
    const { result, rerender } = renderHook(
      ({ authenticated }: { authenticated: boolean }) =>
        useLinkedWalletProfile(authenticated),
      { initialProps: { authenticated: true } },
    );
    await waitFor(() => expect(result.current.linkedAddresses).toEqual([LINKED]));

    rerender({ authenticated: false });

    await waitFor(() =>
      expect(result.current).toEqual({
        linkedAddresses: [],
        activeAddress: null,
        isIncomplete: false,
      }),
    );
  });

  it('does not update state when getUser resolves after unmount', async () => {
    const request = deferred<unknown>();
    mockGetUser.mockReturnValue(request.promise);
    const updates = trackStateUpdates();
    const { unmount } = renderHook(() => useLinkedWalletProfile(true));
    updates.mockClear();

    unmount();
    await act(async () => {
      request.resolve({ addresses: [LINKED], activeAddress: ACTIVE });
    });

    expect(updates).not.toHaveBeenCalled();
  });

  it('does not update state when getUser rejects after unmount', async () => {
    const request = deferred<unknown>();
    mockGetUser.mockReturnValue(request.promise);
    const updates = trackStateUpdates();
    const { unmount } = renderHook(() => useLinkedWalletProfile(true));
    updates.mockClear();

    unmount();
    await act(async () => {
      request.reject(new Error('late'));
    });

    expect(updates).not.toHaveBeenCalled();
  });
});
