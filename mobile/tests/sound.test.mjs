import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newlyFoundCat, replayCorrectSound } from '../src/game/sound.ts';
import bank from '../src/data/puzzles.json' with { type: 'json' };

test('success sound is triggered only by new correct cats', /** 避免錯誤、記號及既有貓重複觸發音效。 */ () => {
  const p = bank.classic[0], before = Array(p.size * p.size).fill(0), next = [...before];
  const wrong = before.findIndex(/** 找出錯誤位置。 */ (_, cell) => !p.solution.includes(cell));
  next[wrong] = 2; assert.equal(newlyFoundCat(p, before, next), -1);
  next[wrong] = 1; assert.equal(newlyFoundCat(p, before, next), -1);
  next[p.solution[0]] = 2; assert.equal(newlyFoundCat(p, before, next), p.solution[0]);
  assert.equal(newlyFoundCat(p, next, next), -1);
});

test('sound rewinds before replay and audio failures do not reject', /** 驗證重播順序與音訊失敗處理。 */ async () => {
  const events = [];
  await replayCorrectSound({ seekTo: /** 記錄音效從頭定位。 */ async seconds => { events.push(seconds); }, play: /** 記錄播放。 */ () => events.push('play') });
  assert.deepEqual(events, [0, 'play']);
  await replayCorrectSound({ seekTo: /** 模擬播放器卸載。 */ async () => { throw Error('disposed'); }, play: /** 定位失敗後不應播放。 */ () => assert.fail() });
  await replayCorrectSound({ seekTo: /** 模擬定位完成。 */ async () => {}, play: /** 模擬裝置拒絕播放。 */ () => { throw Error('unavailable'); } });
});

test('bundled success chime is short mono PCM with smooth quiet endpoints', /** 檢查可離線解碼的 WAV 音效與音量範圍。 */ () => {
  const wav = readFileSync(new URL('../assets/sounds/correct-cat.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt16LE(34), 16);
  const rate = wav.readUInt32LE(24), count = wav.readUInt32LE(40) / 2;
  assert.ok(count / rate > .1 && count / rate < .5);
  let peak = 0; for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  assert.ok(peak > 1000 && peak < 20000); assert.equal(wav.readInt16LE(44), 0); assert.ok(Math.abs(wav.readInt16LE(wav.length - 2)) < 20);
});
