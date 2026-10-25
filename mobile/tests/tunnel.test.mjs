import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
test('Expo can resolve the project-local ngrok dependency without a global install', /** 驗證測試情境：Expo can resolve the project-local ngrok dependency without a global install。 */ () => {
  const { NgrokResolver } = require('../node_modules/@expo/cli/build/src/start/doctor/ngrok/NgrokResolver');
  const resolver = new NgrokResolver(fileURLToPath(new URL('..', import.meta.url)));
  resolver._resolveGlobal = /** 模擬缺少全域套件的環境，以驗證專案內 ngrok 仍可解析。 */ () => { throw Object.assign(new Error('No global installation'), { code: 'MODULE_NOT_FOUND' }); };
  assert.equal(typeof resolver.getVersioned().connect, 'function');
});
