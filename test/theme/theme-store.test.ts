import { secureStorage } from '@/services/storage';
import { useThemeStore } from '@/theme/theme-store';

describe('useThemeStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to the default theme and completes hydration when storage fails', async () => {
    useThemeStore.setState({ mode: 'dark', isHydrated: false });
    jest.spyOn(secureStorage, 'get').mockRejectedValue(new Error('keychain unavailable'));

    await useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().isHydrated).toBe(true);
  });
});
