import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginStroke, cellAt, moveStroke } from '../src/game/drag.ts';

const grid = { size: 5, width: 250, height: 250 };
test('starting on an empty cell adds marks across a fast drag, including the starting cell', () => {
  const original = Array(25).fill(0);
  const start = beginStroke(original, { x: 25, y: 25 }, grid);
  assert.equal(start.dragging, false);
  assert.deepEqual(start.marks, original);
  const end = moveStroke(start, { x: 225, y: 25 }, grid);
  assert.deepEqual(end.marks.slice(0, 5), [1, 1, 1, 1, 1]);
  assert.deepEqual(original, Array(25).fill(0));
});
test('starting on a mark clears the entire stroke without switching mode on empty cells', () => {
  const original = [1, 0, 1, 0, 1, ...Array(20).fill(0)];
  const stroke = moveStroke(beginStroke(original, { x: 25, y: 25 }, grid), { x: 225, y: 25 }, grid);
  assert.equal(stroke.mode, 0);
  assert.deepEqual(stroke.marks, Array(25).fill(0));
  assert.deepEqual(stroke.original, original); // one complete pre-drag undo snapshot
});
test('marking retains existing marks and never overwrites cats', () => {
  const original = [0, 1, 2, 0, 0, ...Array(20).fill(0)];
  const stroke = moveStroke(beginStroke(original, { x: 25, y: 25 }, grid), { x: 225, y: 25 }, grid);
  assert.deepEqual(stroke.marks.slice(0, 5), [1, 1, 2, 1, 1]);
});
test('clearing never removes cats, and a stroke starting on a cat makes no changes', () => {
  const original = [1, 2, 1, 0, 0, ...Array(20).fill(0)];
  const clearing = moveStroke(beginStroke(original, { x: 25, y: 25 }, grid), { x: 225, y: 25 }, grid);
  assert.deepEqual(clearing.marks.slice(0, 5), [0, 2, 0, 0, 0]);
  const cat = moveStroke(beginStroke(original, { x: 75, y: 25 }, grid), { x: 225, y: 25 }, grid);
  assert.deepEqual(cat.marks, original);
});
test('revisiting a cell never toggles it; earlier stroke states remain immutable', () => {
  const start = beginStroke(Array(25).fill(0), { x: 25, y: 25 }, grid);
  const outward = moveStroke(start, { x: 225, y: 25 }, grid);
  const returned = moveStroke(outward, { x: 25, y: 25 }, grid);
  assert.deepEqual(returned.marks, outward.marks);
  assert.equal(returned.visited.size, 5);
  assert.equal(start.visited.size, 0);
});
test('small finger jitter leaves the gesture available for single/double tap handling', () => {
  const start = beginStroke(Array(25).fill(0), { x: 25, y: 25 }, grid);
  assert.equal(moveStroke(start, { x: 29, y: 27 }, grid), start);
});
test('leaving and reentering the board marks only crossed cells inside its bounds', () => {
  let stroke = beginStroke(Array(25).fill(0), { x: 25, y: 25 }, grid);
  stroke = moveStroke(stroke, { x: -25, y: 25 }, grid);
  stroke = moveStroke(stroke, { x: -25, y: 225 }, grid);
  stroke = moveStroke(stroke, { x: 75, y: 225 }, grid);
  assert.deepEqual(stroke.marks.flatMap((m, i) => m === 1 ? [i] : []), [0, 20, 21]);
});
test('hit testing respects all supported sizes and non-square measured bounds', () => {
  for (const size of [5, 6, 7]) {
    const bounds = { size, width: 350, height: 420 };
    assert.equal(cellAt({ x: 349, y: 419 }, bounds), size * size - 1);
    assert.equal(cellAt({ x: 350, y: 10 }, bounds), null);
    assert.equal(cellAt({ x: 0, y: -1 }, bounds), null);
    assert.equal(beginStroke(Array(size * size).fill(0), { x: -1, y: 0 }, bounds), null);
    const stroke = moveStroke(beginStroke(Array(size * size).fill(0), { x: 1, y: 1 }, bounds), { x: 1, y: 419 }, bounds);
    assert.deepEqual(stroke.marks.flatMap((mark, cell) => mark === 1 ? [cell] : []), Array.from({ length: size }, (_, row) => row * size));
  }
  assert.equal(cellAt({ x: NaN, y: 10 }, grid), null);
  assert.equal(cellAt({ x: 0, y: 0 }, { ...grid, width: 0 }), null);
});
