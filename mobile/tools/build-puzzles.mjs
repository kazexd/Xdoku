import { mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makePuzzle, canonicalKey, GENERATOR_VERSION, solve, ratePuzzle, GenerationExhaustedError, regionMinimum, regionLimit } from './generator.ts';
import { isComplete, BOARD_SIZES } from '../src/game/engine.ts';

/** 同目錄原子替換，避免中斷時留下半份 JSON。 */
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  const content = JSON.stringify(value) + '\n';
  if (existsSync(path) && readFileSync(path,'utf8') === content) return;
  try { writeFileSync(temporary, content); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

/** 建立固定順序的八組條件；沒有與恰好一個單格各佔四組。 */
export function generationCases() {
  return BOARD_SIZES.flatMap(/** 每個尺寸建立兩種明確條件。 */ size => [false, true].map(/** 生成前固定該組的單格要求。 */ hasSingleton => ({ id: `${size}x${size}-${hasSingleton ? 'one-singleton' : 'no-singleton'}`, size, hasSingleton })));
}

/** 依內容計算穩定身份，不依輸出順序或種子決定。 */
function puzzleId(p) {
  const payload = { size: p.size, regions: p.regions, solution: p.solution, givens: p.givens, rating: p.rating };
  return `p-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,24)}`;
}

/** 獨立離線驗證群組條件、連通、答案唯一及推理紀錄，不依賴舊 App 題庫上限。 */
export function validateGroupPuzzle(p, group) {
  const size = group.size;
  if (!p || p.size !== size || !Array.isArray(p.regions) || p.regions.length !== size * size || !p.regions.every(/** 所有格子均指向有效色區。 */ r => Number.isInteger(r) && r >= 0 && r < size) || !Array.isArray(p.givens) || p.givens.length !== 0 || !Array.isArray(p.solution) || p.solution.length !== size || !p.solution.every(/** 答案不得越界。 */ cell => Number.isInteger(cell) && cell >= 0 && cell < size * size)) throw new Error('Invalid grouped puzzle structure');
  const counts = Array(size).fill(0);
  for (const region of p.regions) counts[region]++;
  if (counts.filter(/** 計算單格色區。 */ count => count === 1).length !== Number(group.hasSingleton) || counts.some(/** 只有指定單格例外可以低於普通下限。 */ count => !(group.hasSingleton && count === 1) && (count < regionMinimum(size) || count > regionLimit(size)))) throw new Error('Invalid grouped region areas');
  for (let region = 0; region < size; region++) {
    const cells = p.regions.flatMap(/** 收集色區格子。 */ (r, cell) => r === region ? [cell] : []);
    const seen = new Set([cells[0]]), queue = [cells[0]];
    while (queue.length) {
      const cell = queue.pop();
      for (const other of cells) if (!seen.has(other) && Math.abs(Math.floor(other/size)-Math.floor(cell/size)) + Math.abs(other%size-cell%size) === 1) { seen.add(other); queue.push(other); }
    }
    if (seen.size !== cells.length) throw new Error('Disconnected grouped region');
  }
  const marks = p.regions.map(/** 以儲存答案檢查基本放置規則。 */ (_, cell) => p.solution.includes(cell) ? 2 : 0);
  const answers = solve(p), rating = ratePuzzle(p);
  if (!isComplete(p, marks) || answers.length !== 1 || JSON.stringify(answers[0]) !== JSON.stringify(p.solution) || !rating.solved || JSON.stringify(rating) !== JSON.stringify(p.rating) || p.id !== puzzleId(p)) throw new Error('Invalid grouped solution, rating or identity');
  return p;
}

/** 寫出全部群組及清楚標示完成狀態的索引；完全不接觸 App 題庫。 */
function writeGroups(output, state, changedId) {
  if (!output) return;
  const summaries = state.groups.map(/** 每組獨立輸出，未填滿亦保留已驗證成果。 */ group => {
    const complete = group.puzzles.length >= state.config.perCase;
    const filename = `${group.id}.json`;
    if (changedId === undefined || changedId === group.id) save(resolve(output,filename), { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, ...group, target: state.config.perCase, complete });
    return { id: group.id, size: group.size, hasSingleton: group.hasSingleton, file: filename, count: group.puzzles.length, target: state.config.perCase, complete };
  });
  save(resolve(output,'manifest.json'), { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, seed: state.config.seed, attempts: state.config.attempts, tried: state.tried, cursor: state.cursor, complete: summaries.every(/** 全部八組填滿才視為完成。 */ group => group.complete), groups: summaries });
}

/** 輪流搜尋八組，保存全域去重與斷點；每組條件不因失敗而改變。 */
export function buildGroups(options = {}, progress = /** 測試預設不輸出日誌。 */ () => {}) {
  const { perCase = 400, seed = 100000, maxSeeds = 200000, attempts = 500, checkpoint, output } = options;
  if (!Number.isSafeInteger(perCase) || perCase < 1 || perCase > 10000 || !Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(maxSeeds) || maxSeeds < 1 || seed + maxSeeds > 0xffffffff || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10000) throw new RangeError('Invalid grouped generation options');
  const config = { version: GENERATOR_VERSION, perCase, seed, attempts };
  const cases = generationCases();
  let state = { config, tried: 0, cursor: 0, groups: cases.map(/** 初始化八組獨立題目陣列。 */ group => ({ ...group, puzzles: [] })) };
  if (checkpoint && existsSync(checkpoint)) {
    state = JSON.parse(readFileSync(checkpoint,'utf8'));
    if (state.config?.version !== config.version || state.config.seed !== seed || state.config.attempts !== attempts) throw new Error('Checkpoint configuration mismatch; choose another --checkpoint');
    state.config = config;
    if (!Number.isSafeInteger(state.tried) || state.tried < 0 || state.tried > 0xffffffff - seed || !Number.isSafeInteger(state.cursor) || state.cursor < state.tried || state.cursor > state.tried * 8 || !Array.isArray(state.groups) || state.groups.length !== cases.length) throw new Error('Invalid checkpoint state');
  }
  // 即使斷點遺失或落後，仍從已輸出的分組成果補回題目；先驗證，後寫入。
  if (output) {
    const manifestPath = resolve(output,'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath,'utf8'));
      if (manifest.schemaVersion !== 1 || manifest.generatorVersion !== GENERATOR_VERSION || manifest.seed !== seed || manifest.attempts !== attempts || !Number.isSafeInteger(manifest.tried) || manifest.tried < 0 || manifest.tried > 0xffffffff - seed || (manifest.cursor !== undefined && (!Number.isSafeInteger(manifest.cursor) || manifest.cursor < manifest.tried || manifest.cursor > manifest.tried * cases.length))) throw new Error('Output manifest configuration or counters mismatch');
      if (manifest.tried > state.tried) {
        state.tried = manifest.tried;
        state.cursor = manifest.cursor ?? manifest.tried * cases.length;
      }
    }
    cases.forEach(/** 逐組讀取已有結果，不相信 complete 或 target 標籤，依實際題數判斷。 */ (expected, i) => {
      const path = resolve(output,`${expected.id}.json`);
      if (!existsSync(path)) return;
      const existing = JSON.parse(readFileSync(path,'utf8'));
      if (existing.schemaVersion !== 1 || existing.generatorVersion !== GENERATOR_VERSION || existing.id !== expected.id || existing.size !== expected.size || existing.hasSingleton !== expected.hasSingleton || !Array.isArray(existing.puzzles)) throw new Error('Invalid existing output group');
      if (!Array.isArray(state.groups[i]?.puzzles)) throw new Error('Invalid checkpoint group');
      const byId = new Map(state.groups[i].puzzles.map(/** 保留斷點原順序，僅追加輸出中尚未記錄的題目。 */ p => [p.id,p]));
      const outputIds = new Set();
      for (const puzzle of existing.puzzles) {
        if (outputIds.has(puzzle.id)) throw new Error('Duplicate existing output puzzle');
        outputIds.add(puzzle.id);
        if (byId.has(puzzle.id)) {
          if (JSON.stringify(byId.get(puzzle.id)) !== JSON.stringify(puzzle)) throw new Error('Conflicting existing output puzzle');
        } else { state.groups[i].puzzles.push(puzzle); byId.set(puzzle.id,puzzle); }
      }
    });
  }
  const used = new Set(), ids = new Set();
  let accepted = 0;
  state.groups.forEach(/** 嚴格驗證斷點內容，重建全域去重。 */ (group, i) => {
    if (group.id !== cases[i].id || group.size !== cases[i].size || group.hasSingleton !== cases[i].hasSingleton || !Array.isArray(group.puzzles)) throw new Error('Invalid checkpoint group');
    for (const puzzle of group.puzzles) {
      validateGroupPuzzle(puzzle, group);
      const key = canonicalKey(puzzle);
      if (used.has(key) || ids.has(puzzle.id)) throw new Error('Duplicate checkpoint puzzle');
      used.add(key); ids.add(puzzle.id); accepted++;
    }
  });
  // 沒有完整種子紀錄時，以已保留題數作保守起點；全域去重仍防止重複收錄。
  state.tried = Math.max(state.tried,accepted);
  state.cursor = Math.max(state.cursor,state.tried);
  const total = state.groups.reduce(/** 已超額的組別只計到目標，保留額外題目而不截斷。 */ (sum,group) => sum + Math.min(group.puzzles.length,perCase),0);
  let filled = total;
  for (const group of state.groups) progress({ status: group.puzzles.length >= perCase ? 'skip' : 'resume', caseId: group.id, count: group.puzzles.length, perCase, tried: state.tried, maxSeeds, accepted: filled, total: perCase * cases.length });
  if (checkpoint) save(checkpoint,state);
  writeGroups(output,state);
  while (filled < perCase * cases.length && state.tried < maxSeeds) {
    const group = state.groups[state.cursor++ % cases.length];
    if (group.puzzles.length >= perCase) continue;
    let changed = false;
    try {
      const generated = makePuzzle(seed + state.tried, group.size, used, attempts, group.hasSingleton);
      const puzzle = { ...generated, id: puzzleId(generated) };
      validateGroupPuzzle(puzzle, group);
      group.puzzles.push(puzzle); used.add(canonicalKey(puzzle)); ids.add(puzzle.id); accepted++; filled++; changed = true;
    } catch (error) { if (!(error instanceof GenerationExhaustedError)) throw error; }
    state.tried++;
    // 新題目立即落盤；連續失敗時每 25 個種子保存一次，減少大題庫的寫入量。
    if (changed || state.tried % 25 === 0 || state.tried === maxSeeds) {
      if (checkpoint) save(checkpoint,state);
      writeGroups(output,state,changed ? group.id : null);
    }
    progress({ status: 'search', tried: state.tried, maxSeeds, accepted: filled, total: perCase * cases.length, caseId: group.id, count: group.puzzles.length, perCase });
  }
  if (filled < perCase * cases.length) throw new GenerationExhaustedError(`Seed budget exhausted (${state.tried}). Partial groups and checkpoint retained; increase --max-seeds to resume. App catalog unchanged.`);
  return state;
}

/** 解析分組生成參數；輸出與斷點路徑分開，避免覆蓋玩家題庫。 */
function main() {
  const options = { 'per-case': 400, seed: 100000, 'max-seeds': 200000, attempts: 500, output: 'generated-puzzles/v7', checkpoint: '.puzzle-generation/groups-v7.json' };
  const args = process.argv.slice(2);
  for (let i=0;i<args.length;i+=2) {
    const name = args[i].replace(/^--/,'');
    if (!Object.hasOwn(options,name) || args[i+1] === undefined) throw new Error('Options: --per-case --seed --max-seeds --attempts --output --checkpoint');
    options[name] = name === 'output' || name === 'checkpoint' ? args[i+1] : Number(args[i+1]);
  }
  const output = resolve(options.output), checkpoint = resolve(options.checkpoint);
  const appData = fileURLToPath(new URL('../src/data',import.meta.url));
  if (output === appData || output.startsWith(appData + '/') || output.startsWith(appData + '\\') || checkpoint === resolve(appData,'puzzles.json') || checkpoint === resolve(output,'manifest.json') || generationCases().some(/** 斷點不能覆蓋分組檔案。 */ group => checkpoint === resolve(output,`${group.id}.json`))) throw new Error('Output/checkpoint must not overwrite app data or group files');
  console.log(`Output: ${output}\nCheckpoint: ${checkpoint}`);
  buildGroups({ perCase: options['per-case'], seed: options.seed, maxSeeds: options['max-seeds'], attempts: options.attempts, output, checkpoint }, /** 每個種子回報目前組別及總進度。 */ p => console.log(`${p.status === 'skip' ? 'SKIP' : p.status === 'resume' ? 'RESUME' : 'SEARCH'} ${p.caseId}: ${p.count}/${p.perCase}; total ${p.accepted}/${p.total}; seeds ${p.tried}/${p.maxSeeds}`));
  console.log(`Saved 8 complete groups, ${options['per-case']} puzzles each (${options['per-case'] * 8} total). App catalog unchanged.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    if (!(error instanceof GenerationExhaustedError)) throw error;
    console.error(error.message); process.exitCode = 1;
  }
}
