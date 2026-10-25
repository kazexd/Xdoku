import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTap } from '../src/game/taps.ts';

test('single tap toggles an exclusion mark and clears a cat', () => {
  assert.equal(resolveTap(0, 0, 1000, 'a', null).mark, 1);
  assert.equal(resolveTap(1, 0, 1000, 'a', null).mark, 0);
  assert.equal(resolveTap(2, 0, 1000, 'a', null).mark, 0);
});
test('double tap places a cat from empty or excluded and is one undo move', () => {
  for (const original of [0, 1]) {
    const first = resolveTap(original, 0, 1000, 'a', null);
    const second = resolveTap(first.mark, 0, 1200, 'a', first.lastTap);
    assert.equal(second.mark, 2);
    assert.equal(second.replaceMove, true);
    assert.equal(second.lastTap, null);
  }
});
test('double tap on a cat clears it', () => {
  const first = resolveTap(2, 0, 1000, 'a', null);
  assert.equal(resolveTap(first.mark, 0, 1200, 'a', first.lastTap).mark, 0);
});
test('slow taps, different cells and different boards are separate single taps', () => {
  const first = resolveTap(0, 0, 1000, 'a', null);
  for (const [cell, time, board] of [[0, 1301, 'a'], [1, 1100, 'a'], [0, 1100, 'b']]) {
    const next = resolveTap(1, cell, time, board, first.lastTap);
    assert.equal(next.mark, 0);
    assert.equal(next.replaceMove, false);
  }
});
test('a third tap starts a new action after a double tap', () => {
  const first = resolveTap(0, 0, 1000, 'a', null);
  const second = resolveTap(first.mark, 0, 1100, 'a', first.lastTap);
  const third = resolveTap(second.mark, 0, 1200, 'a', second.lastTap);
  assert.equal(third.mark, 0);
  assert.equal(third.replaceMove, false);
});
