import assert from 'node:assert/strict';
import test from 'node:test';
import { Cooldown } from '../src/utils/cooldown.js';

test('blocks a second request inside the cooldown window', () => {
  let now = 5_000;
  const cooldown = new Cooldown(1_000, () => now);

  assert.equal(cooldown.tryAcquire('user-1'), true);
  assert.equal(cooldown.tryAcquire('user-1'), false);
  assert.equal(cooldown.tryAcquire('user-2'), true);

  now += 1_000;
  assert.equal(cooldown.tryAcquire('user-1'), true);
});
