import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../src/lib/auth/next';

describe('post-login redirect', () => {
  test('keeps local paths', () => {
    assert.equal(safeNext('/earnings'), '/earnings');
    assert.equal(safeNext('/matches?sport=hockey'), '/matches?sport=hockey');
  });

  test('refuses to leave the site', () => {
    const backslash = String.fromCharCode(92);
    const nul = String.fromCharCode(0);
    const bad = [
      '//evil.com',
      '/' + backslash + 'evil.com',
      'https://evil.com',
      'evil.com',
      'javascript:alert(1)',
      '/' + nul + '//evil.com',
    ];
    for (const b of bad) assert.equal(safeNext(b), '/', JSON.stringify(b));
  });

  test('empty goes home', () => {
    assert.equal(safeNext(null), '/');
    assert.equal(safeNext(''), '/');
  });
});
