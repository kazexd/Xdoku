import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, restoreRound, MAX_FISH } from '../src/game/lives.ts';
import bank from '../src/data/puzzles.json' with { type: 'json' };
const p = bank.classic[0];
/** 建立空白回合。 */
function fresh() { return restoreRound(p, null); }
/** 建立單格變更。 */
function move(round, cell, mark) { const next = [...round.marks]; next[cell] = mark; return applyMove(p, round, next); }

test('only incorrect new cats consume fish; wrong cells become X', /** 檢查正確貓、記號及錯誤貓的不同結果。 */ () => {
  const round = fresh(), wrong = p.regions.findIndex(/** 找出非答案位置。 */ (_, cell) => !p.solution.includes(cell));
  assert.equal(move(round, p.solution[0], 2).round.fish, MAX_FISH);
  assert.equal(move(round, wrong, 1).round.fish, MAX_FISH);
  const result = move(round, wrong, 2);
  assert.equal(result.wrong, wrong); assert.equal(result.round.fish, 2); assert.equal(result.round.marks[wrong], 1);
  assert.equal(round.marks[wrong], 0);
});

test('third mistake ends the round and further moves are ignored', /** 驗證三次機會及終局鎖定。 */ () => {
  let round = fresh();
  const wrong = p.regions.flatMap(/** 選取三個不同錯誤格。 */ (_, cell) => !p.solution.includes(cell) ? [cell] : []);
  for (let i = 2; i >= 0; i--) { round = move(round, wrong[i], 2).round; assert.equal(round.fish, i); }
  assert.deepEqual(move(round, p.solution[0], 2), { round, wrong: null });
  assert.equal(fresh().fish, 3);
});

test('saved fish persist including game over; legacy and corrupt saves are repaired', /** 檢查存檔與舊格式遷移。 */ () => {
  const round = fresh();
  for (const fish of [0, 1, 2, 3]) assert.equal(restoreRound(p, JSON.parse(JSON.stringify({ ...round, fish }))).fish, fish);
  const old = [...round.marks], wrong = p.regions.findIndex(/** 找出錯誤貓。 */ (_, cell) => !p.solution.includes(cell)); old[wrong] = 2;
  assert.equal(restoreRound(p, old).marks[wrong], 1);
  assert.equal(restoreRound(p, old).fish, 3);
  for (const invalid of [null, [], { marks: [99], fish: 0 }]) assert.deepEqual(restoreRound(p, invalid), round);
});


test('mistakes lock X against taps, cat placement and drag erasure and survive saves', /** 驗證錯誤鎖定不能被操作或存檔覆蓋。 */ () => {
  const wrong = p.regions.findIndex(/** 取得錯誤格。 */ (_, cell) => !p.solution.includes(cell));
  const round = move(fresh(), wrong, 2).round;
  assert.deepEqual(round.mistakes, [wrong]);
  for (const mark of [0, 1, 2]) {
    const result = move(round, wrong, mark);
    assert.equal(result.round.marks[wrong], 1); assert.equal(result.round.fish, 2); assert.equal(result.wrong, null);
  }
  const saved = JSON.parse(JSON.stringify(round)); saved.marks[wrong] = 0;
  assert.deepEqual(restoreRound(p, saved), round);
  assert.deepEqual(fresh().mistakes, []);
  const corrupt = restoreRound(p, { ...round, mistakes: [-1, 9999, p.solution[0], wrong, wrong] });
  assert.deepEqual(corrupt.mistakes, [wrong]);
});


test('correct cats remain locked against all edits and after reloading', /** 驗證已找到及提示揭示的貓不可被移除，重新開始才清除。 */ () => {
  const cell = p.solution[0], round = move(fresh(), cell, 2).round;
  for (const mark of [0, 1, 2]) {
    const result = move(round, cell, mark);
    assert.equal(result.round.marks[cell], 2); assert.equal(result.round.fish, 3); assert.equal(result.wrong, null);
  }
  const restored = restoreRound(p, JSON.parse(JSON.stringify(round)));
  assert.equal(move(restored, cell, 0).round.marks[cell], 2);
  const next = [...round.marks]; next[cell] = 0; next[p.solution[1]] = 1;
  const edited = applyMove(p, round, next).round;
  assert.equal(edited.marks[cell], 2); assert.equal(edited.marks[p.solution[1]], 1);
  assert.equal(fresh().marks[cell], 0);
});
