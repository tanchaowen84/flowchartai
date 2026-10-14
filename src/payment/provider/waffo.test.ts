import { createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyWaffoEvent } from './waffo';
describe('real SDK raw webhook verification', () => {
  afterEach(() => vi.unstubAllEnvs());
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  function signed(mode = 'test', store = 'STO_fixture', time = Date.now()) {
    vi.stubEnv('WAFFO_ENVIRONMENT', 'test');
    vi.stubEnv('WAFFO_STORE_ID', 'STO_fixture');
    vi.stubEnv(
      'WAFFO_WEBHOOK_TEST_PUBLIC_KEY',
      keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    );
    const raw = JSON.stringify({
      id: 'delivery-1',
      eventId: 'PAY_fixture',
      eventType: 'order.completed',
      timestamp: new Date().toISOString(),
      mode,
      storeId: store,
      data: { orderId: 'ORD_fixture' },
    });
    // Fixture signer only; production verification is exclusively the official SDK.
    const sign = createSign('RSA-SHA256');
    sign.update(`${time}.${raw}`);
    return {
      raw,
      signature: `t=${time},v1=${sign.sign(keys.privateKey, 'base64')}`,
    };
  }
  it('accepts exact raw payload using official verification', () => {
    const s = signed();
    expect(verifyWaffoEvent(s.raw, s.signature)).toMatchObject({
      eventId: 'PAY_fixture',
      mode: 'test',
    });
  });
  it('rejects tampering and forged signatures', () => {
    const s = signed();
    expect(() => verifyWaffoEvent(s.raw + ' ', s.signature)).toThrow();
    expect(() => verifyWaffoEvent(s.raw, 't=0,v1=invalid')).toThrow();
  });
  it('rejects another store/environment and expired delivery', () => {
    const wrong = signed('test', 'STO_other');
    expect(() => verifyWaffoEvent(wrong.raw, wrong.signature)).toThrow();
    const prod = signed('prod');
    expect(() => verifyWaffoEvent(prod.raw, prod.signature)).toThrow();
    const expired = signed('test', 'STO_fixture', Date.now() - 3600000);
    expect(() => verifyWaffoEvent(expired.raw, expired.signature)).toThrow();
  });
});
