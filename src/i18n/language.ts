import * as SecureStore from 'expo-secure-store';
import { secureStorage, StorageKeys } from '@/services/storage';

export type AppLanguage = 'de' | 'en';

let languageRequestGeneration = 0;
let languagePersistenceQueue: Promise<void> = Promise.resolve();

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
): Promise<boolean> {
  const requestGeneration = ++languageRequestGeneration;
  await instance.changeLanguage(language);
  if (requestGeneration !== languageRequestGeneration) return false;

  let persisted = false;
  const persistLatestLanguage = async () => {
    if (requestGeneration !== languageRequestGeneration) return;
    try {
      await secureStorage.set(StorageKeys.SELECTED_LANGUAGE, language);
      if (requestGeneration !== languageRequestGeneration) return;
      persisted = true;
    } catch {
      // The active language remains usable even if secure storage is temporarily unavailable.
    }
  };

  languagePersistenceQueue = languagePersistenceQueue.then(
    persistLatestLanguage,
    persistLatestLanguage,
  );
  await languagePersistenceQueue;
  return persisted && requestGeneration === languageRequestGeneration;
}
