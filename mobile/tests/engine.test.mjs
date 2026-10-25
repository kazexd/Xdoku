import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZES, canonicalKey, levelPuzzle, ratePuzzle, makePuzzle, solve, conflicts, isComplete, dailySeed } from '../src/game/engine.ts';

test('100 seeds per size have a unique solution, connected regions and a deduction path', () => {
  for (const size of BOARD_SIZES) {
  for (let seed = 1; seed <= 100; seed++) {
    const p = makePuzzle(seed, size);
    assert.deepEqual(solve(p), [p.solution]);
    assert.equal(p.rating.solved, true);
    assert.equal(p.rating.singles, size);
    assert.deepEqual(p.rating, ratePuzzle({ ...p, solution: [] }));
    for (let region = 0; region < p.size; region++) {
      const cells = p.regions.flatMap((r, i) => r === region ? [i] : []);
      const seen = new Set([cells[0]]), queue = [cells[0]];
      while (queue.length) {
        const a = queue.pop();
        for (const b of cells) if (!seen.has(b) && Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs(a % size - b % size) === 1) { seen.add(b); queue.push(b); }
      }
      assert.equal(seen.size, cells.length);
    }
    assert.ok(isComplete(p, p.regions.map((_, i) => p.solution.includes(i) ? 2 : 0)));
    assert.ok(!isComplete(p, Array(size * size).fill(0)));
    assert.ok(!isComplete(p, p.solution.map(() => 2)));
  }
  }
});
test('generation is deterministic; UTC daily seed agrees across offsets', () => {
  assert.deepEqual(makePuzzle(20261025), makePuzzle(20261025));
  assert.equal(dailySeed(new Date('2026-10-24T20:00:00-04:00')), 20261025);
});

test('answers vary beyond the old two fixed permutations', () => {
  for (const size of BOARD_SIZES) {
    const answers = new Set(Array.from({ length: 40 }, (_, i) => makePuzzle(i + 1, size).solution.join(',')));
    assert.ok(answers.size > 10, `${size}: only ${answers.size} distinct answers`);
  }
});

test('canonical identity ignores relabeling, rotations and reflections', () => {
  const p = makePuzzle(1, 6);
  const identity = canonicalKey(p);
  for (let mirror = 0; mirror < 2; mirror++) for (let rotation = 0; rotation < 4; rotation++) {
    const regions = Array(p.regions.length);
    p.regions.forEach((region, cell) => {
      let r = Math.floor(cell / p.size), c = cell % p.size;
      if (mirror) c = p.size - 1 - c;
      for (let k = 0; k < rotation; k++) [r, c] = [c, p.size - 1 - r];
      regions[r * p.size + c] = 100 - region;
    });
    assert.equal(canonicalKey({ ...p, regions }), identity);
  }
});

test('an excluded candidate is regenerated instead of being returned', () => {
  for (const size of BOARD_SIZES) {
    const first = makePuzzle(17, size);
    const excluded = new Set([canonicalKey(first)]);
    const replacement = makePuzzle(17, size, excluded);
    assert.ok(!excluded.has(canonicalKey(replacement)));
    assert.deepEqual(solve(replacement), [replacement.solution]);
    assert.equal(replacement.rating.solved, true);
  }
});

test('classic catalog excludes repeats including symmetry and preserves deterministic identity', () => {
  for (const size of BOARD_SIZES) {
    const keys = new Set();
    for (let level = 1; level <= 40; level++) {
      const p = levelPuzzle(level, size);
      assert.ok(!keys.has(canonicalKey(p)));
      assert.deepEqual(p, makePuzzle(level, size, keys));
      keys.add(canonicalKey(p));
    }
    assert.equal(levelPuzzle(1, size).id, `v2:${size}:1`);
  }
});

test('difficulty grades are based on deduction work', () => {
  const ratings = Array.from({ length: 100 }, (_, i) => makePuzzle(i + 1).rating);
  assert.deepEqual(new Set(ratings.map(r => r.difficulty)), new Set(['easy', 'medium', 'hard']));
  for (const rating of ratings) {
    assert.equal(rating.difficulty, rating.deductions === 0 ? 'easy' : rating.deductions <= 3 ? 'medium' : 'hard');
  }
  const unconstrained = { id: 'ambiguous', size: 5, regions: Array.from({ length: 25 }, (_, i) => Math.floor(i / 5)), solution: [] };
  assert.equal(solve(unconstrained).length, 2);
  assert.equal(ratePuzzle(unconstrained).solved, false);
});

test('invalid generator inputs fail explicitly', () => {
  for (const size of [0, 4, 8, 5.5]) assert.throws(() => makePuzzle(1, size), RangeError);
  for (const seed of [NaN, Infinity, 1.5]) assert.throws(() => makePuzzle(seed), RangeError);
  assert.throws(() => levelPuzzle(0), RangeError);
});
test('row, column, region and diagonal conflicts are rejected', () => {
  const p = makePuzzle(1);
  assert.ok(conflicts(p, 0, 4));
  assert.ok(conflicts(p, 0, 20));
  assert.ok(conflicts(p, 0, 6));
  assert.ok(!isComplete(p, Array(25).fill(2)));
});
