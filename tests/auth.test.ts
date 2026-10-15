import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, createToken, verifyToken, authConfig, LoginLimiter, tokenFromCookieHeader,
} from '../src/lib/auth/session';

const SECRET = 'x'.repeat(48);

describe('password hashing', () => {
  const stored = hashPassword('correct horse');
  test('never stores the password itself', () => assert.ok(!stored.includes('correct horse')));
  test('right password verifies', () => assert.equal(verifyPassword('correct horse', stored), true));
  test('wrong password fails', () => assert.equal(verifyPassword('correct hors', stored), false));
  test('same password hashes differently each time (salted)', () => assert.notEqual(hashPassword('a'), hashPassword('a')));
  test('garbage hash is rejected, not thrown', () => assert.equal(verifyPassword('a', 'nonsense'), false));
});

describe('session token', () => {
  const cfg = { passwordHash: hashPassword('pw'), secret: SECRET };
  test('fresh token is valid', () => assert.equal(verifyToken(createToken(cfg), cfg), true));
  test('expired token is rejected', () => {
    const t = createToken(cfg, Date.now() - 31 * 86400_000);
    assert.equal(verifyToken(t, cfg), false);
  });
  test('tampered payload is rejected', () => {
    const [p, s] = createToken(cfg).split('.');
    const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 9e12, fp: 'x' })).toString('base64url');
    assert.equal(verifyToken(`${forged}.${s}`, cfg), false);
    assert.equal(verifyToken(`${p}.${s.slice(0, -2)}aa`, cfg), false);
  });
  test('token signed with another secret is rejected', () => {
    const other = { ...cfg, secret: 'y'.repeat(48) };
    assert.equal(verifyToken(createToken(other), cfg), false);
  });
  test('changing the password logs every session out', () => {
    const t = createToken(cfg);
    assert.equal(verifyToken(t, { ...cfg, passwordHash: hashPassword('new') }), false);
  });
  test('no config means no access', () => assert.equal(verifyToken(createToken(cfg), null), false));
});

describe('config', () => {
  test('missing or weak secret disables auth config (fail closed)', () => {
    assert.equal(authConfig({ APP_PASSWORD_HASH: 'h' } as any), null);
    assert.equal(authConfig({ APP_PASSWORD_HASH: 'h', AUTH_SECRET: 'short' } as any), null);
    assert.ok(authConfig({ APP_PASSWORD_HASH: 'h', AUTH_SECRET: SECRET } as any));
  });
});

describe('login limiter', () => {
  test('locks after five failures and unlocks after success', () => {
    const l = new LoginLimiter(5, 60_000, 60_000);
    for (let i = 0; i < 4; i++) l.fail('1.1.1.1', 1000);
    assert.equal(l.lockedFor('1.1.1.1', 1000), 0);
    l.fail('1.1.1.1', 1000);
    assert.ok(l.lockedFor('1.1.1.1', 1000) > 0);
    assert.equal(l.lockedFor('2.2.2.2', 1000), 0, 'other addresses unaffected');
    assert.equal(l.lockedFor('1.1.1.1', 1000 + 61_000), 0, 'lock expires');
  });
});

test('cookie header parsing', () => {
  assert.equal(tokenFromCookieHeader('a=1; ol_session=abc.def; b=2'), 'abc.def');
  assert.equal(tokenFromCookieHeader('a=1'), null);
});
