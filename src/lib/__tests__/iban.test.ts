import { describe, it, expect } from 'vitest';
import { validateIBAN } from '@/lib/iban';

describe('validateIBAN', () => {
  it('validates a correct ES IBAN', () => {
    expect(validateIBAN('ES7921000813610201234567')).toBe(true);
  });

  it('validates a correct DE IBAN', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
  });

  it('rejects an IBAN with wrong length', () => {
    expect(validateIBAN('ES792100081361020123456')).toBe(false);
  });

  it('rejects an IBAN with invalid checksum', () => {
    expect(validateIBAN('ES7921000813610201234568')).toBe(false);
  });

  it('rejects an IBAN with invalid country code', () => {
    expect(validateIBAN('XX7921000813610201234567')).toBe(false);
  });

  it('handles IBAN with spaces', () => {
    expect(validateIBAN('ES79 2100 0813 6102 0123 4567')).toBe(true);
  });

  it('handles IBAN with lowercase letters', () => {
    expect(validateIBAN('es7921000813610201234567')).toBe(true);
  });
});
