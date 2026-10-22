/** Pure helpers for how a contact is presented: initials, avatar colour slot, "last used" wording. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of avatar colour slots; the avatar component maps each slot to a brand colour. */
export const AVATAR_COLOR_COUNT = 4;

/** First letters of the first two words, upper-cased; `?` for a blank name. */
export function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '');
  const initials = letters.join('').toUpperCase();
  return initials === '' ? '?' : initials;
}

/** Stable colour slot per name, so a contact keeps its colour across launches. */
export function avatarColorIndex(name: string): number {
  let sum = 0;
  for (const char of name.trim().toLowerCase()) sum += char.codePointAt(0) ?? 0;
  return sum % AVATAR_COLOR_COUNT;
}

export type LastUsed = {
  key: 'today' | 'yesterday' | 'days' | 'weeks' | 'months';
  count: number;
};

/** Coarse "how long ago" for the amount screen ("zuletzt vor 2 Tagen"). */
export function describeLastUsed(lastUsedAt: number, now: number): LastUsed {
  const days = Math.max(0, Math.floor((now - lastUsedAt) / DAY_MS));
  if (days === 0) return { key: 'today', count: 0 };
  if (days === 1) return { key: 'yesterday', count: 1 };
  if (days < 14) return { key: 'days', count: days };
  if (days < 60) return { key: 'weeks', count: Math.floor(days / 7) };
  return { key: 'months', count: Math.floor(days / 30) };
}
