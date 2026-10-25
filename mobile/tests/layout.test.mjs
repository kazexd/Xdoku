import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenLayout, paginateSections, splitPage } from '../src/game/layout.ts';
import { cellAt, beginStroke, moveStroke } from '../src/game/drag.ts';

test('square boards fit measured chrome at phone sizes and larger text', /** 覆蓋尺寸、字體增加造成的固定高度及最大棋盤尺寸。 */ () => {
  for (const [width, height] of [[320,568],[375,667],[390,844],[430,932],[1024,1366]]) for (const scale of [1,1.5,2]) {
    const header = 180 * scale, footer = 44 * scale;
    const layout = screenLayout(Math.min(width,480), height - 60, header, footer);
    assert.ok(layout.board >= 0 && layout.board <= 432);
    assert.ok(layout.board + layout.padding * 2 <= Math.min(width,480));
    assert.ok(layout.board + header + footer + layout.gap * 2 + layout.padding * 2 <= height - 60);
    for (const size of [7,8,9,10]) {
      const side = layout.board - 6, grid = { size, width: side, height: side };
      if (side <= 0) continue;
      for (let cell = 0; cell < size * size; cell++) assert.equal(cellAt({ x: (cell % size + .5) * side / size, y: (Math.floor(cell / size) + .5) * side / size },grid),cell);
      const marks = Array(size * size).fill(0), y = side / size / 2;
      const stroke = beginStroke(marks, { x: side / size / 2, y }, grid);
      const moved = moveStroke(stroke, { x: side - side / size / 2, y }, grid);
      assert.deepEqual(moved.marks.slice(0,size),Array(size).fill(1));
    }
  }
  assert.equal(screenLayout(0,0).board,0);
});

test('pagination and measured splitting preserve all content including Unicode', /** 所有主題及字元都能從分頁重組，不裁切、不省略。 */ () => {
  const sections = [{title:'操作',text:'點一下 ×，雙擊 🐱。'.repeat(35)},{title:'資訊',text:'後續功能與進度。'.repeat(20)}];
  for (const scale of [1,1.5,2,3]) {
    const pages = paginateSections(sections,260,200,scale);
    for (const section of sections) assert.equal(pages.filter(/** 收集同主題分頁。 */ p=>p.title===section.title).map(/** 重組全文。 */ p=>p.text).join(''),section.text);
    for (const page of pages) assert.equal(splitPage(page).map(/** 重組實際量測後拆分的片段。 */ p=>p.text).join(''),page.text);
  }
  assert.ok(paginateSections(sections,260,200,2).length > paginateSections(sections,260,200,1).length);
});
