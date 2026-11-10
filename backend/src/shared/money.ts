// Money is always an integer number of minor units (kobo for NGN) so we never touch
 // floating point. 1 NGN = 100 kobo.
 
export const MAX_TRANSACTION_AMOUNT = 100_000_000_000; // 1bn NGN
export const MAX_BALANCE = 9_000_000_000_000_000; // stays inside Number.MAX_SAFE_INTEGER
export const CURRENCY = 'NGN';

export const toMinorUnits = (major: number): number => Math.round(major * 100);
