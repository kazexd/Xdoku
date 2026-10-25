import { mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makePuzzle, canonicalKey, boardSize, GENERATOR_VERSION, solve, ratePuzzle, GenerationExhaustedError } from './generator.ts';
import { validateCatalog } from '../src/game/catalog-schema.ts';

/** 使用同目錄暫存檔替換資料，避免中斷時留下半份題庫。 */
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value) + '\n'); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

/** 有界搜尋無預放貓題庫；失敗種子跳過，接受題目的尺寸不隨失敗改變。 */
export function buildCatalog(classicCount = 200, dailyCount = 365, seed = 100000, progress = /** 預設靜默供測試使用。 */ () => {}, options = {}) {
  const { maxSeeds = 20000, attempts = 500, checkpoint, sizes } = options;
  if (![classicCount, dailyCount].every(/** 限制題池大小。 */ n => Number.isSafeInteger(n) && n > 0 && n <= 10000) || !Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(maxSeeds) || maxSeeds < 1 || seed + maxSeeds > 0xffffffff || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10000 || (sizes && (!sizes.length || !sizes.every(/** 限制自訂測試尺寸。 */ n => [7,8,9,10].includes(n))))) throw new RangeError('Invalid generation options');
  const config = { version: GENERATOR_VERSION, classicCount, dailyCount, seed, attempts, sizes: sizes ?? null };
  let state = { config, tried: 0, bank: { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, dailyEpoch: '2026-10-25', classic: [], daily: [] } };
  if (checkpoint && existsSync(checkpoint)) {
    state = JSON.parse(readFileSync(checkpoint, 'utf8'));
    if (JSON.stringify(state.config) !== JSON.stringify(config) || !Number.isSafeInteger(state.tried) || state.tried < 0 || state.tried > 0xffffffff - seed) throw new Error('Checkpoint configuration mismatch; use a different --checkpoint path');
    if (state.bank.classic.length > classicCount || state.bank.daily.length > dailyCount || state.bank.classic.length + state.bank.daily.length > state.tried || (state.bank.daily.length && state.bank.classic.length !== classicCount)) throw new Error('Invalid checkpoint counts');
  }
  const bank = state.bank, used = new Set();
  for (const p of [...bank.classic, ...bank.daily]) {
    validateCatalog({ ...bank, classic: [p], daily: [{ ...p, id: p.id + '-check' }] });
    const key = canonicalKey(p);
    if (used.has(key) || solve(p).length !== 1 || !ratePuzzle(p).solved) throw new Error('Invalid checkpoint puzzle');
    used.add(key);
  }
  const total = classicCount + dailyCount;
  while (bank.classic.length + bank.daily.length < total && state.tried < maxSeeds) {
    const done = bank.classic.length + bank.daily.length;
    const size = sizes ? sizes[done % sizes.length] : boardSize(seed + done);
    const candidateSeed = seed + state.tried;
    try {
      const puzzle = makePuzzle(candidateSeed, size, used, attempts);
      if (solve(puzzle).length !== 1 || !ratePuzzle(puzzle).solved) throw new Error('Generated puzzle failed offline validation');
      used.add(canonicalKey(puzzle));
      const payload = { size, regions: puzzle.regions, solution: puzzle.solution, givens: puzzle.givens, rating: puzzle.rating };
      const id = `p-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}`;
      (done < classicCount ? bank.classic : bank.daily).push({ id, ...payload });
    } catch (error) { if (!(error instanceof GenerationExhaustedError)) throw error; }
    state.tried++;
    if (checkpoint) save(checkpoint, state);
    progress(bank.classic.length + bank.daily.length, total, state.tried, size);
  }
  if (bank.classic.length + bank.daily.length < total) throw new GenerationExhaustedError(`Seed budget exhausted (${state.tried}); checkpoint retained. Increase --max-seeds to resume. Published catalog unchanged.`);
  return validateCatalog(bank);
}

/** 完整通過驗證後才發佈新題庫；相同參數再次執行會自動續跑。 */
function main() {
  const options = { classic: 200, daily: 365, seed: 100000, 'max-seeds': 20000, attempts: 500, checkpoint: '.puzzle-generation/checkpoint.json' };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].replace(/^--/, '');
    if (!Object.hasOwn(options, name) || args[i + 1] === undefined) throw new Error('Options: --classic --daily --seed --max-seeds --attempts --checkpoint');
    options[name] = name === 'checkpoint' ? args[i + 1] : Number(args[i + 1]);
  }
  console.log(`Checkpoint: ${resolve(options.checkpoint)}`);
  const bank = buildCatalog(options.classic, options.daily, options.seed, /** 每個種子顯示進度與目前尺寸。 */ (done, total, tried, size) => console.log(`Validated ${done}/${total}; seeds ${tried}/${options['max-seeds']}; size ${size}x${size}`), { maxSeeds: options['max-seeds'], attempts: options.attempts, checkpoint: resolve(options.checkpoint) });
  save(fileURLToPath(new URL('../src/data/puzzles.json', import.meta.url)), bank);
  console.log(`Saved ${bank.classic.length} classic and ${bank.daily.length} daily puzzles`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
