import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { sumAmounts } from '../../src/services/claimTotalService';

describe('sumAmounts (claim.total recalculation core)', () => {
  it('sums a list of decimal amounts exactly (no float rounding drift)', () => {
    const total = sumAmounts([new Prisma.Decimal('10.10'), new Prisma.Decimal('20.20'), new Prisma.Decimal('0.05')]);
    expect(total.toString()).toBe('30.35');
  });

  it('returns 0 for a claim with no items', () => {
    expect(sumAmounts([]).toString()).toBe('0');
  });

  it('handles many small decimals without the classic 0.1+0.2 float error', () => {
    const amounts = Array.from({ length: 10 }, () => new Prisma.Decimal('0.1'));
    expect(sumAmounts(amounts).toString()).toBe('1');
  });

  it('accepts plain numbers and strings, not just Decimal instances', () => {
    expect(sumAmounts([100, '50.50', 25]).toString()).toBe('175.5');
  });
});
