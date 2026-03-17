import test from 'node:test';
import assert from 'node:assert';
import { generateTotpSecret, verifyTotpCode } from '../utils/twoFactor';

test('verifyTotpCode fails closed for mismatched code length without throwing', () => {
  const secret = generateTotpSecret();

  assert.doesNotThrow(() => {
    const ok = verifyTotpCode(secret, '1', 1);
    assert.strictEqual(ok, false);
  });
});
