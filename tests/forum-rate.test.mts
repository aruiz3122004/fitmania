import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkForumRate, remainingForumPosts, formatCountdown } from '../lib/forum-rate.ts';

const now = new Date('2026-10-25T15:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

test('sin historial o tras 5 minutos de calma se empieza de nuevo', () => {
  assert.deepEqual(checkForumRate(null, now), { allowed: true, nextCount: 1 });
  assert.deepEqual(checkForumRate({ count: 3, last: ago(5 * 60_000 + 1) }, now), { allowed: true, nextCount: 1 });
});

test('permite 3 seguidas y bloquea la cuarta hasta 5 minutos después de la última', () => {
  assert.deepEqual(checkForumRate({ count: 1, last: ago(10_000) }, now), { allowed: true, nextCount: 2 });
  assert.deepEqual(checkForumRate({ count: 2, last: ago(10_000) }, now), { allowed: true, nextCount: 3 });
  const blocked = checkForumRate({ count: 3, last: ago(60_000) }, now);
  assert.equal(blocked.allowed, false);
  assert.equal(!blocked.allowed && blocked.retryAt.getTime(), now.getTime() + 4 * 60_000);
});

test('cuenta las publicaciones que quedan', () => {
  assert.equal(remainingForumPosts(null, now), 3);
  assert.equal(remainingForumPosts({ count: 2, last: ago(1000) }, now), 1);
  assert.equal(remainingForumPosts({ count: 3, last: ago(1000) }, now), 0);
});

test('formatea la cuenta regresiva', () => {
  assert.equal(formatCountdown(4 * 60_000 + 5_000), '4:05');
  assert.equal(formatCountdown(400), '0:01');
  assert.equal(formatCountdown(-5), '0:00');
});
