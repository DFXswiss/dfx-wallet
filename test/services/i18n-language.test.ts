import * as SecureStore from 'expo-secure-store';
import { normalizeLanguage, resolveInitialLanguageSync, setLanguage } from '@/i18n/language';
import { secureStorage, StorageKeys } from '@/services/storage';

jest.mock('@/services/storage', () => ({
  StorageKeys: { SELECTED_LANGUAGE: 'selectedLanguage' },
  secureStorage: { get: jest.fn(async () => null), set: jest.fn(async () => undefined) },
}));

jest.mock('expo-secure-store', () => ({ getItem: jest.fn(() => null) }));

describe('persisted app language', () => {
  it('accepts only supported persisted languages', () => {
    expect(normalizeLanguage('de')).toBe('de');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('de-CH')).toBeNull();
    expect(normalizeLanguage('fr')).toBeNull();
  });

  it('persists before changing the active language', async () => {
    const callOrder: string[] = [];
    (secureStorage.set as jest.Mock).mockImplementationOnce(async () => {
      callOrder.push('persist');
    });
    const changeLanguage = jest.fn(async () => {
      callOrder.push('activate');
    });
    await setLanguage('de', { changeLanguage });
    expect(secureStorage.set).toHaveBeenCalledWith(StorageKeys.SELECTED_LANGUAGE, 'de');
    expect(changeLanguage).toHaveBeenCalledWith('de');
    expect(callOrder).toEqual(['persist', 'activate']);
  });

  it('reads a supported persisted language synchronously during startup', () => {
    (SecureStore.getItem as jest.Mock).mockReturnValueOnce('de');
    expect(resolveInitialLanguageSync('en')).toBe('de');
    (SecureStore.getItem as jest.Mock).mockReturnValueOnce('fr');
    expect(resolveInitialLanguageSync('en')).toBe('en');
  });
});
