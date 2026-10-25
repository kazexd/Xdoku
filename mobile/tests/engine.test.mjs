import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePuzzle, solve, conflicts, isComplete, dailySeed } from '../src/game/engine.ts';

test('100 seeds have a unique solution and connected regions', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const p = makePuzzle(seed);
    assert.deepEqual(solve(p), [p.solution]);
    for (let region = 0; region < p.size; region++) {
      const cells = p.regions.flatMap((r, i) => r === region ? [i] : []);
      const seen = new Set([cells[0]]), queue = [cells[0]];
      while (queue.length) {
        const a = queue.pop();
        for (const b of cells) if (!seen.has(b) && Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) + Math.abs(a % 5 - b % 5) === 1) { seen.add(b); queue.push(b); }
      }
      assert.equal(seen.size, cells.length);
    }
    assert.ok(isComplete(p, p.regions.map((_, i) => p.solution.includes(i) ? 2 : 0)));
    assert.ok(!isComplete(p, Array(25).fill(0)));
  }
});
test('generation is deterministic; UTC daily seed agrees across offsets', () => {
  assert.deepEqual(makePuzzle(20261025), makePuzzle(20261025));
  assert.equal(dailySeed(new Date('2026-10-24T20:00:00-04:00')), 20261025);
});
test('row, column, region and diagonal conflicts are rejected', () => {
  const p = makePuzzle(1);
  assert.ok(conflicts(p, 0, 4));
  assert.ok(conflicts(p, 0, 20));
  assert.ok(conflicts(p, 0, 6));
  assert.ok(!isComplete(p, Array(25).fill(2)));
});
