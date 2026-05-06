import type { AssetTicker } from '@/services/pricing-service';

export const SYMBOL_TO_TICKER = new Map<string, AssetTicker>([
  ['BTC', 'btc'],
  ['ETH', 'eth'],
  ['USDT', 'usdt'],
  ['USDC', 'usdt'],
  ['MATIC', 'matic'],
]);

export const SYMBOL_COLORS = new Map<string, string>([
  ['BTC', '#F7931A'],
  ['ETH', '#627EEA'],
  ['USDT', '#26A17B'],
  ['USDC', '#2775CA'],
  ['ZCHF', '#0E1F3A'],
  ['MATIC', '#8247E5'],
]);

export const SYMBOL_GLYPH = new Map<string, string>([
  ['BTC', '₿'],
  ['ETH', 'Ξ'],
  ['USDT', '₮'],
  ['USDC', '$'],
  ['ZCHF', '₣'],
  ['MATIC', '⧫'],
]);

export const CHAIN_LABELS = new Map<string, string>([
  ['ethereum', 'Ethereum'],
  ['arbitrum', 'Arbitrum'],
  ['polygon', 'Polygon'],
  ['spark', 'Lightning'],
  ['plasma', 'Plasma'],
  ['sepolia', 'Sepolia'],
]);

export const formatBalance = (rawBalance: string, decimals: number): string => {
  if (!rawBalance) return '0';
  try {
    const value = BigInt(rawBalance);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const fractional = value % divisor;
    if (fractional === 0n) return whole.toString();
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fractionalStr ? `${whole}.${fractionalStr}` : whole.toString();
  } catch {
    return rawBalance;
  }
};

export const toNumeric = (formatted: string): number => {
  const n = parseFloat(formatted);
  return Number.isFinite(n) ? n : 0;
};

export const formatNumber = (n: number, maxFractionDigits = 8): string => {
  if (n === 0) return '0';
  if (n >= 1) return n.toFixed(2);
  const fixed = n.toFixed(maxFractionDigits);
  return fixed.replace(/\.?0+$/, '');
};
