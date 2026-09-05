import { describe, expect, it } from '@jest/globals';
import { sessionId, tenantId, type TenantId } from './ids';

describe('branded ids', () => {
  it('carries the underlying string through unchanged at runtime', () => {
    expect(tenantId('santi-riyanks')).toBe('santi-riyanks');
    expect(typeof sessionId('abc')).toBe('string');
  });

  it('keeps distinct brands from being interchangeable', () => {
    const scopedToTenant = (value: TenantId): string => value;

    // @ts-expect-error a SessionId must never satisfy a TenantId parameter — this is the
    // compile-time guard against one event's data leaking into another.
    expect(scopedToTenant(sessionId('s_1'))).toBe('s_1');
  });
});
