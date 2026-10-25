import { mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makePuzzle, canonicalKey, boardSize, GENERATOR_VERSION, solve, ratePuzzle } from './generator.ts';
import { validateCatalog } from '../src/game/catalog-schema.ts';

/** 在開發電腦預先生成及驗證兩個獨立題池，輸出順序、內容及 ID 均可重現。 */
export function buildCatalog(classicCount = 200, dailyCount = 365, seed = 100000, progress = /** 預設不輸出進度，方便測試與其他工具呼叫。 */ () => {}) {
  if (![classicCount, dailyCount].every(/** 避免空題庫或意外產生無限制工作。 */ count => Number.isSafeInteger(count) && count > 0 && count <= 10000) || !Number.isSafeInteger(seed) || seed < 0 || seed + classicCount + dailyCount > 0xffffffff) throw new RangeError('Invalid catalog counts or seed');
  const used = new Set();
  const bank = { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, dailyEpoch: '2026-10-25', classic: [], daily: [] };
  for (let i = 0; i < classicCount + dailyCount; i++) {
    const candidateSeed = seed + i;
    const puzzle = makePuzzle(candidateSeed, boardSize(candidateSeed), used);
    if (solve(puzzle).length !== 1 || !ratePuzzle(puzzle).solved) throw new Error('Generated puzzle failed offline validation');
    used.add(canonicalKey(puzzle));
    const payload = { size: puzzle.size, regions: puzzle.regions, solution: puzzle.solution, givens: puzzle.givens, rating: puzzle.rating };
    const id = `p-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}`;
    (i < classicCount ? bank.classic : bank.daily).push({ id, ...payload });
    progress(i + 1, classicCount + dailyCount);
  }
  return validateCatalog(bank);
}

/** 解析命令列並原子寫入 JSON；失敗時保留原有已發佈題庫。 */
function main() {
  const options = { classic: 200, daily: 365, seed: 100000 };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].replace(/^--/, '');
    if (!Object.hasOwn(options, name) || args[i + 1] === undefined) throw new Error('Usage: --classic <count> --daily <count> --seed <integer>');
    options[name] = Number(args[i + 1]);
  }
  const bank = buildCatalog(options.classic, options.daily, options.seed, /** 定期回報預先生成進度，不影響題庫內容。 */ (done, total) => { if (done % 25 === 0 || done === total) console.log(`Validated ${done}/${total} puzzles`); });
  const target = fileURLToPath(new URL('../src/data/puzzles.json', import.meta.url));
  const temporary = `${target}.${process.pid}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  try { writeFileSync(temporary, JSON.stringify(bank) + '\n'); renameSync(temporary, target); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
  console.log(`Saved ${bank.classic.length} classic and ${bank.daily.length} daily puzzles`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
