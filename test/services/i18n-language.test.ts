import * as SecureStore from 'expo-secure-store';
import { waitFor } from '@testing-library/react-native';
import { normalizeLanguage, resolveInitialLanguageSync, setLanguage } from '@/i18n/language';
import { secureStorage, StorageKeys } from '@/services/storage';

jest.mock('@/services/storage', () => ({
  StorageKeys: { SELECTED_LANGUAGE: 'selectedLanguage' },
  secureStorage: { get: jest.fn(async () => null), set: jest.fn(async () => undefined) },
}));

jest.mock('expo-secure-store', () => ({ getItem: jest.fn(() => null) }));

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('persisted app language', () => {
  beforeEach(() => {
    (secureStorage.set as jest.Mock).mockReset();
    (secureStorage.set as jest.Mock).mockResolvedValue(undefined);
  });

  it('accepts only supported persisted languages', () => {
    expect(normalizeLanguage('de')).toBe('de');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('de-CH')).toBeNull();
    expect(normalizeLanguage('fr')).toBeNull();
  });

  it('changes the active language before persisting it', async () => {
    const callOrder: string[] = [];
    (secureStorage.set as jest.Mock).mockImplementationOnce(async () => {
      callOrder.push('persist');
    });
    const changeLanguage = jest.fn(async () => {
      callOrder.push('activate');
    });
    await expect(setLanguage('de', { changeLanguage })).resolves.toBe(true);
    expect(secureStorage.set).toHaveBeenCalledWith(StorageKeys.SELECTED_LANGUAGE, 'de');
    expect(changeLanguage).toHaveBeenCalledWith('de');
    expect(callOrder).toEqual(['activate', 'persist']);
  });

  it('keeps the activated language when persistence fails', async () => {
    let activeLanguage = 'en';
    const changeLanguage = jest.fn(async (language: string) => {
      activeLanguage = language;
    });
    (secureStorage.set as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(setLanguage('de', { changeLanguage })).resolves.toBe(false);

    expect(activeLanguage).toBe('de');
    expect(secureStorage.set).toHaveBeenCalledWith(StorageKeys.SELECTED_LANGUAGE, 'de');
  });

  it('serializes persistence so only the latest language request succeeds', async () => {
    const firstPersist = createDeferred();
    const secondPersist = createDeferred();
    const persistedLanguages: string[] = [];
    (secureStorage.set as jest.Mock)
      .mockImplementationOnce(async (_key: string, language: string) => {
        await firstPersist.promise;
        persistedLanguages.push(language);
      })
      .mockImplementationOnce(async (_key: string, language: string) => {
        await secondPersist.promise;
        persistedLanguages.push(language);
      });
    const changeLanguage = jest.fn(async () => undefined);

    const firstResult = setLanguage('de', { changeLanguage });
    await waitFor(() => expect(secureStorage.set).toHaveBeenCalledTimes(1));

    const secondResult = setLanguage('en', { changeLanguage });
    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('en'));

    secondPersist.resolve();
    firstPersist.resolve();

    await expect(firstResult).resolves.toBe(false);
    await expect(secondResult).resolves.toBe(true);
    expect(secureStorage.set).toHaveBeenNthCalledWith(1, StorageKeys.SELECTED_LANGUAGE, 'de');
    expect(secureStorage.set).toHaveBeenNthCalledWith(2, StorageKeys.SELECTED_LANGUAGE, 'en');
    expect(persistedLanguages).toEqual(['de', 'en']);
    expect(persistedLanguages[persistedLanguages.length - 1]).toBe('en');
  });

  it('reads a supported persisted language synchronously during startup', () => {
    (SecureStore.getItem as jest.Mock).mockReturnValueOnce('de');
    expect(resolveInitialLanguageSync('en')).toBe('de');
    (SecureStore.getItem as jest.Mock).mockReturnValueOnce('fr');
    expect(resolveInitialLanguageSync('en')).toBe('en');
  });
});
