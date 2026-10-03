import * as SecureStore from 'expo-secure-store';
import { secureStorage, StorageKeys } from '@/services/storage';

export type AppLanguage = 'de' | 'en';

export function normalizeLanguage(language: string | null | undefined): AppLanguage | null {
  if (language === 'de' || language === 'en') return language;
  return null;
}

export function resolveInitialLanguageSync(fallback: AppLanguage): AppLanguage {
  try {
    return normalizeLanguage(SecureStore.getItem(StorageKeys.SELECTED_LANGUAGE)) ?? fallback;
  } catch {
    // Secure storage can be temporarily unavailable before the device unlocks.
    return fallback;
  }
}

export async function setLanguage(
  language: AppLanguage,
  instance: { changeLanguage: (language: string) => Promise<unknown> },
): Promise<void> {
  await secureStorage.set(StorageKeys.SELECTED_LANGUAGE, language);
  await instance.changeLanguage(language);
}
