import { act, renderHook } from '@testing-library/react-native';
import {
  ALWAYS_ON_CHAINS,
  DEFAULT_ENABLED_CHAINS,
  IMPLICIT_ENABLED_CHAINS,
} from '@/config/tokens';
import type { ChainId } from '@/config/chains';

const mockMmkv = { raw: undefined as string | undefined };

jest.mock('react-native-mmkv', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useMMKVString: () => {
      const [raw, setRaw] = React.useState<string | undefined>(mockMmkv.raw);
      return [
        raw,
        (next: string | undefined) => {
          mockMmkv.raw = next;
          setRaw(next);
        },
      ];
    },
  };
});

// eslint-disable-next-line import/first
import { useEnabledChains } from '@/features/portfolio/useEnabledChains';

const MERGED_DEFAULT = Array.from(
  new Set([...DEFAULT_ENABLED_CHAINS, ...ALWAYS_ON_CHAINS, ...IMPLICIT_ENABLED_CHAINS]),
);

describe('useEnabledChains', () => {
  beforeEach(() => {
    mockMmkv.raw = undefined;
  });

  it('falls back to DEFAULT_ENABLED_CHAINS when nothing is stored', () => {
    const { result } = renderHook(() => useEnabledChains());
    expect(result.current.enabledChains).toEqual(MERGED_DEFAULT);
  });

  it('falls back to DEFAULT_ENABLED_CHAINS when stored JSON is invalid', () => {
    mockMmkv.raw = '{not-json';
    const { result } = renderHook(() => useEnabledChains());
    expect(result.current.enabledChains).toEqual(MERGED_DEFAULT);
  });

  it('falls back to DEFAULT_ENABLED_CHAINS when stored value is an empty array', () => {
    mockMmkv.raw = '[]';
    const { result } = renderHook(() => useEnabledChains());
    expect(result.current.enabledChains).toEqual(MERGED_DEFAULT);
  });

  it('falls back to DEFAULT_ENABLED_CHAINS when stored value is not an array', () => {
    mockMmkv.raw = JSON.stringify({ ethereum: true });
    const { result } = renderHook(() => useEnabledChains());
    expect(result.current.enabledChains).toEqual(MERGED_DEFAULT);
  });

  it('merges ALWAYS_ON + IMPLICIT chains into a stored selection', () => {
    mockMmkv.raw = JSON.stringify(['polygon'] satisfies ChainId[]);
    const { result } = renderHook(() => useEnabledChains());
    expect(result.current.enabledChains).toEqual(
      Array.from(new Set(['polygon', ...ALWAYS_ON_CHAINS, ...IMPLICIT_ENABLED_CHAINS])),
    );
  });

  it('setEnabledChains persists the JSON-encoded list', () => {
    const { result } = renderHook(() => useEnabledChains());
    act(() => {
      result.current.setEnabledChains(['ethereum', 'polygon']);
    });
    expect(mockMmkv.raw).toBe(JSON.stringify(['ethereum', 'polygon']));
  });

  it('toggleChain adds a chain that is not yet enabled', () => {
    mockMmkv.raw = JSON.stringify(['ethereum'] satisfies ChainId[]);
    const { result } = renderHook(() => useEnabledChains());
    act(() => {
      result.current.toggleChain('polygon');
    });
    expect(result.current.enabledChains).toContain('polygon');
    expect(JSON.parse(mockMmkv.raw!)).toContain('polygon');
  });

  it('toggleChain removes a chain that is already enabled', () => {
    mockMmkv.raw = JSON.stringify(['ethereum', 'polygon'] satisfies ChainId[]);
    const { result } = renderHook(() => useEnabledChains());
    act(() => {
      result.current.toggleChain('polygon');
    });
    expect(JSON.parse(mockMmkv.raw!)).not.toContain('polygon');
    expect(JSON.parse(mockMmkv.raw!)).toContain('ethereum');
  });
});
