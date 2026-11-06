import {
  AVATAR_COLOR_COUNT,
  avatarColorIndex,
  contactInitials,
  describeLastUsed,
} from '@/features/transfer/contacts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('contactInitials', () => {
  it('takes the first letter of up to two words, upper-cased', () => {
    expect(contactInitials('Anna')).toBe('A');
    expect(contactInitials('anna meier')).toBe('AM');
    expect(contactInitials('  Hans Peter Muster ')).toBe('HP');
  });

  it('falls back to a question mark for a blank name', () => {
    expect(contactInitials('   ')).toBe('?');
    expect(contactInitials('')).toBe('?');
  });
});

describe('avatarColorIndex', () => {
  it('is stable per name and independent of case and surrounding space', () => {
    expect(avatarColorIndex('Anna')).toBe(avatarColorIndex('Anna'));
    expect(avatarColorIndex('Anna')).toBe(avatarColorIndex('  anna '));
  });

  it('stays inside the colour slots and uses more than one of them', () => {
    const names = ['Anna', 'Marco', 'Lea', 'Tim', 'Sven', 'Noa', 'Jan', 'Eva'];
    const indexes = names.map(avatarColorIndex);
    expect(indexes.every((i) => Number.isInteger(i) && i >= 0 && i < AVATAR_COLOR_COUNT)).toBe(
      true,
    );
    expect(new Set(indexes).size).toBeGreaterThan(1);
  });

  it('maps a known name to a known slot', () => {
    // a(97) + n(110) + n(110) + a(97) = 414; 414 % 4 = 2
    expect(avatarColorIndex('Anna')).toBe(2);
  });
});

describe('describeLastUsed', () => {
  it('reads today, yesterday, days, weeks and months', () => {
    expect(describeLastUsed(NOW - 5 * 60 * 1000, NOW)).toEqual({ key: 'today', count: 0 });
    expect(describeLastUsed(NOW - DAY, NOW)).toEqual({ key: 'yesterday', count: 1 });
    expect(describeLastUsed(NOW - 2 * DAY, NOW)).toEqual({ key: 'days', count: 2 });
    expect(describeLastUsed(NOW - 13 * DAY, NOW)).toEqual({ key: 'days', count: 13 });
    expect(describeLastUsed(NOW - 14 * DAY, NOW)).toEqual({ key: 'weeks', count: 2 });
    expect(describeLastUsed(NOW - 59 * DAY, NOW)).toEqual({ key: 'weeks', count: 8 });
    expect(describeLastUsed(NOW - 60 * DAY, NOW)).toEqual({ key: 'months', count: 2 });
  });

  it('treats a timestamp in the future as today', () => {
    expect(describeLastUsed(NOW + DAY, NOW)).toEqual({ key: 'today', count: 0 });
  });
});
