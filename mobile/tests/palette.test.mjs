import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION_COLORS, MARK_COLOR, regionColor } from '../src/game/palette.ts';
import { BOARD_SIZES } from '../src/game/engine.ts';
import bank from '../src/data/puzzles.json' with { type: 'json' };

/** 將 sRGB 色碼轉為線性 RGB，供亮度及色差測試使用。 */
function linearRGB(hex) {
  return [1, 3, 5].map(/** 取出各通道並移除 sRGB 的非線性編碼。 */ offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
}

/** 轉為 D65 參考白點的 CIELAB 座標，避免僅以色碼不同誤認為視覺差異充足。 */
function lab(hex) {
  const [r, g, b] = linearRGB(hex);
  const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047,
    r * .2126729 + g * .7151522 + b * .072175,
    (r * .0193339 + g * .119192 + b * .9503041) / 1.08883];
  const [x, y, z] = xyz.map(/** 以 CIELAB 分段函數轉換正規化的 XYZ 通道。 */ value => value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** 計算線性 RGB 的相對亮度以檢查排除記號是否清晰。 */
function luminance(hex) {
  const [r, g, b] = linearRGB(hex);
  return .2126 * r + .7152 * g + .0722 * b;
}

test('ten region colors are unique and have substantial pairwise Lab separation', /** 驗證十色獨立且任意兩色不會退回原本相近的淡色。 */ () => {
  assert.equal(REGION_COLORS.length, 10);
  assert.equal(new Set(REGION_COLORS).size, 10);
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
    const first = lab(REGION_COLORS[a]), second = lab(REGION_COLORS[b]);
    const distance = Math.hypot(...first.map(/** 計算各 Lab 軸的色差。 */ (v, i) => v - second[i]));
    assert.ok(distance >= 18, `${a}/${b}: Lab distance ${distance}`);
  }
});

test('dark exclusion marks remain readable against every region', /** 驗證每個色區與記號之間至少有 4.5:1 的亮度對比。 */ () => {
  for (const color of REGION_COLORS) assert.ok((luminance(color) + .05) / (luminance(MARK_COLOR) + .05) >= 4.5);
});

test('each generated region maps to a distinct stable color for all board sizes', /** 驗證同區同色、不同區不同色，不會因尺寸變大而循環重用顏色。 */ () => {
  for (const size of BOARD_SIZES) {
    const puzzle = [...bank.classic, ...bank.daily].find(/** 取現有題庫的指定尺寸。 */ p => p.size === size);
    const colors = new Set();
    for (let region = 0; region < size; region++) {
      assert.ok(puzzle.regions.includes(region));
      assert.equal(regionColor(region), REGION_COLORS[region]);
      colors.add(regionColor(region));
    }
    assert.equal(colors.size, size);
  }
  for (const region of [-1, 10, 1.5, NaN]) assert.throws(/** 無效色區須明確拒絕，不可回退至另一隻貓的顏色。 */ () => regionColor(region), RangeError);
});
