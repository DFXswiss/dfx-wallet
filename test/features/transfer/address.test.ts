import {
  addressesEqual,
  getAddressKind,
  isEvmAddress,
  isIban,
  isPlausibleAddress,
  maskIban,
  normalizeAddressInput,
  shortenAddress,
} from '@/features/transfer/address';

const EVM = `0x${'ab12'.repeat(10)}`;
// BIP-173 reference address (whitelisted fixture, see eslint.config.js).
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

describe('isPlausibleAddress', () => {
  it('accepts a well-formed EVM address', () => {
    expect(isPlausibleAddress(EVM)).toBe(true);
  });

  it('rejects a 0x string that is not a full EVM address', () => {
    expect(isPlausibleAddress('0x1234')).toBe(false);
    expect(isPlausibleAddress(`0x${'zz'.repeat(20)}`)).toBe(false);
    expect(isPlausibleAddress(`${EVM}00`)).toBe(false);
  });

  it('accepts other formats from 26 characters on', () => {
    expect(isPlausibleAddress(BTC)).toBe(true);
    expect(isPlausibleAddress('a'.repeat(26))).toBe(true);
    expect(isPlausibleAddress('a'.repeat(25))).toBe(false);
  });

  it('rejects whitespace inside the address and trims around it', () => {
    expect(isPlausibleAddress(`${BTC.slice(0, 20)} ${BTC.slice(20)}`)).toBe(false);
    expect(isPlausibleAddress(`  ${BTC}  `)).toBe(true);
    expect(isPlausibleAddress('')).toBe(false);
  });
});

describe('address kind', () => {
  it('tells EVM from everything else', () => {
    expect(getAddressKind(EVM)).toBe('evm');
    expect(getAddressKind(` ${EVM}`)).toBe('evm');
    expect(getAddressKind(BTC)).toBe('other');
    expect(isEvmAddress(EVM)).toBe(true);
    expect(isEvmAddress(BTC)).toBe(false);
  });

  it('compares EVM addresses case-insensitively and other addresses exactly', () => {
    expect(addressesEqual(EVM, EVM.toUpperCase().replace('0X', '0x'))).toBe(true);
    expect(addressesEqual(` ${EVM} `, EVM)).toBe(true);
    expect(addressesEqual(BTC, BTC)).toBe(true);
    expect(addressesEqual(BTC, BTC.toUpperCase())).toBe(false);
    expect(addressesEqual(EVM, BTC)).toBe(false);
  });
});

describe('isIban', () => {
  it('recognises an IBAN with or without spaces', () => {
    expect(isIban('CH9300762011623852957')).toBe(true);
    expect(isIban('CH93 0076 2011 6238 5295 7')).toBe(true);
  });

  it('does not take addresses or short strings for IBANs', () => {
    expect(isIban(BTC)).toBe(false);
    expect(isIban(EVM)).toBe(false);
    expect(isIban('CH93 0076')).toBe(false);
    expect(isIban('ch9300762011623852957')).toBe(false);
    expect(isIban('')).toBe(false);
  });
});

describe('normalizeAddressInput', () => {
  it('strips the URI scheme and the query', () => {
    expect(normalizeAddressInput('ethereum:0xabc?amount=1')).toBe('0xabc');
    expect(normalizeAddressInput(`bitcoin:${BTC}?amount=0.1&label=x`)).toBe(BTC);
  });

  it('trims and leaves plain addresses alone', () => {
    expect(normalizeAddressInput(`  ${BTC}\n`)).toBe(BTC);
    expect(normalizeAddressInput(EVM)).toBe(EVM);
  });
});

describe('display helpers', () => {
  it('shortenAddress keeps head and tail', () => {
    expect(shortenAddress(BTC)).toBe('bc1qar0s…wf5mdq');
    expect(shortenAddress(BTC, 4, 4)).toBe('bc1q…5mdq');
  });

  it('shortenAddress passes short strings through', () => {
    expect(shortenAddress('abc')).toBe('abc');
    expect(shortenAddress('a'.repeat(15))).toBe('a'.repeat(15));
  });

  it('maskIban shows the first and last four characters', () => {
    expect(maskIban('CH93 0076 2011 6238 5295 7')).toBe('CH93 •••• 2957');
    expect(maskIban('CH93')).toBe('CH93');
  });
});
