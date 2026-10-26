import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGroups, generationCases, validateGroupPuzzle } from '../tools/build-puzzles.mjs';
import { GenerationExhaustedError, makePuzzle } from '../tools/generator.ts';

test('eight groups have fixed sizes and singleton policies before search', /** 驗證八組完整涵蓋兩種條件，沒有隨機比例。 */ () => {
  const cases = generationCases(); assert.equal(cases.length,8);
  assert.deepEqual(cases.map(/** 列出群組條件。 */ p=>[p.size,p.hasSingleton]),[[7,false],[7,true],[8,false],[8,true],[9,false],[9,true],[10,false],[10,true]]);
  for (const options of [{perCase:0},{perCase:1.5},{maxSeeds:0},{attempts:0},{seed:-1},{seed:0xffffffff}]) assert.throws(/** 拒絕非法參數。 */ ()=>buildGroups(options),RangeError);
});

test('partial grouped output resumes deterministically and never alters the app bank', /** 真正生成小量題目，驗證檔案、續跑及條件驗證。 */ () => {
  const dir=mkdtempSync(join(tmpdir(),'xdoku-groups-')), output=join(dir,'output'), checkpoint=join(dir,'checkpoint.json');
  const app=new URL('../src/data/puzzles.json',import.meta.url), before=readFileSync(app,'utf8');
  try {
    const options={perCase:1,seed:1,attempts:500,output,checkpoint,maxSeeds:1};
    assert.throws(/** 第一組完成亦必須等待其他七組。 */ ()=>buildGroups(options),GenerationExhaustedError);
    let manifest=JSON.parse(readFileSync(join(output,'manifest.json'),'utf8'));
    assert.equal(manifest.complete,false);assert.equal(manifest.groups.length,8);assert.equal(manifest.groups[0].count,1);assert.equal(manifest.groups[0].complete,true);
    assert.equal(manifest.groups[1].count,0);
    const first=JSON.parse(readFileSync(join(output,manifest.groups[0].file),'utf8'));
    validateGroupPuzzle(first.puzzles[0],first);
    assert.throws(/** 同一棋盤不可改標為含單格。 */ ()=>validateGroupPuzzle(first.puzzles[0],{...first,hasSingleton:true}));
    const areas=structuredClone(first.puzzles[0]); areas.regions.fill(0); assert.throws(/** 拒絕超上限與空色區。 */ ()=>validateGroupPuzzle(areas,first),/areas/);
    const bad=structuredClone(first.puzzles[0]);bad.givens=[bad.solution[0]];assert.throws(/** 不接受預放貓。 */ ()=>validateGroupPuzzle(bad,first));
    assert.throws(/** 增加總預算即可續跑相同設定。 */ ()=>buildGroups({...options,maxSeeds:2}),GenerationExhaustedError);
    const resumed=JSON.parse(readFileSync(checkpoint,'utf8'));
    const other=join(dir,'other.json');assert.throws(/** 對照未中斷的兩次種子搜尋。 */ ()=>buildGroups({...options,checkpoint:other,output:undefined,maxSeeds:2}),GenerationExhaustedError);
    assert.deepEqual(resumed,JSON.parse(readFileSync(other,'utf8')));
    manifest=JSON.parse(readFileSync(join(output,'manifest.json'),'utf8'));assert.equal(manifest.groups[1].count,1);
    assert.throws(/** 更改起始種子不得混用斷點。 */ ()=>buildGroups({...options,seed:2,maxSeeds:3}));
    const corrupt=structuredClone(resumed);corrupt.groups[1].puzzles[0]=corrupt.groups[0].puzzles[0];writeFileSync(checkpoint,JSON.stringify(corrupt));assert.throws(/** 拒絕錯組或重複斷點。 */ ()=>buildGroups({...options,maxSeeds:3}));
    assert.equal(readFileSync(app,'utf8'),before);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('singleton selection is fixed, deterministic and no-singleton never falls back', /** 即使搜尋失敗也不可放寬面積或偷偷加入單格。 */ () => {
  assert.deepEqual(makePuzzle(1,7,new Set(),500,true),makePuzzle(1,7,new Set(),500,true));
  assert.throws(/** 低預算下明確失敗，不改用容易的單格組。 */ ()=>makePuzzle(1,10,new Set(),1,false),GenerationExhaustedError);
  assert.throws(/** 單格選項必須是布林值。 */ ()=>makePuzzle(1,7,new Set(),1,'yes'),RangeError);
});


test('default quota is four hundred per group, never four hundred total', /** 檢查預設目標與索引數量，而不執行完整生成。 */ () => {
  const dir=mkdtempSync(join(tmpdir(),'xdoku-group-default-')), checkpoint=join(dir,'checkpoint.json');
  try {
    assert.throws(/** 只用一個種子檢查預設配置。 */ ()=>buildGroups({seed:1,attempts:1,maxSeeds:1,checkpoint}),GenerationExhaustedError);
    const state=JSON.parse(readFileSync(checkpoint,'utf8'));
    assert.equal(state.config.perCase,400);assert.equal(state.groups.length*state.config.perCase,3200);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});


test('finished groups are skipped and output files recover a missing checkpoint', /** 完成組不再搜尋，從分組與索引恢復題目及種子位置。 */ () => {
  const dir=mkdtempSync(join(tmpdir(),'xdoku-resume-output-')), output=join(dir,'output'), checkpoint=join(dir,'checkpoint.json');
  try {
    const options={perCase:1,seed:1,attempts:500,maxSeeds:2,checkpoint,output};
    assert.throws(/** 先產生兩個完成組。 */ ()=>buildGroups(options),GenerationExhaustedError);
    const before=JSON.parse(readFileSync(checkpoint,'utf8')), path=join(output,'7x7-no-singleton.json'), original=readFileSync(path,'utf8');
    rmSync(checkpoint);
    const events=[];
    assert.throws(/** 從第 3 個種子續跑，不重算前兩組。 */ ()=>buildGroups({...options,maxSeeds:3},/** 記錄實際排程。 */ event=>events.push(event)),GenerationExhaustedError);
    const restored=JSON.parse(readFileSync(checkpoint,'utf8'));
    assert.equal(restored.tried,3);
    assert.deepEqual(restored.groups[0].puzzles,before.groups[0].puzzles);assert.deepEqual(restored.groups[1].puzzles,before.groups[1].puzzles);
    assert.equal(readFileSync(path,'utf8'),original);
    assert.deepEqual(events.filter(/** 收集被跳過的組。 */ e=>e.status==='skip').map(/** 讀取組別名稱。 */ e=>e.caseId),['7x7-no-singleton','7x7-one-singleton']);
    assert.ok(events.filter(/** 只檢查實際搜尋。 */ e=>e.status==='search').every(/** 不可搜尋已完成組。 */ e=>e.caseId!=='7x7-no-singleton'&&e.caseId!=='7x7-one-singleton'));
    // 模擬斷點落後於已輸出的第二組，應補回結果而非覆蓋成空白。
    writeFileSync(checkpoint,JSON.stringify({...before,tried:1,cursor:1,groups:before.groups.map(/** 保留只有第一組的舊斷點。 */ (g,i)=>i===1?{...g,puzzles:[]}:g)}));
    assert.throws(/** 讀取較新的輸出結果。 */ ()=>buildGroups({...options,maxSeeds:3}),GenerationExhaustedError);
    assert.deepEqual(JSON.parse(readFileSync(checkpoint,'utf8')).groups[1].puzzles,before.groups[1].puzzles);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('raising quotas resumes existing groups and lowering quotas never truncates results', /** 更改目標數量仍保留原題目及全域去重。 */ () => {
  const dir=mkdtempSync(join(tmpdir(),'xdoku-quota-change-')), output=join(dir,'output'), checkpoint=join(dir,'checkpoint.json');
  try {
    const options={perCase:1,seed:1,attempts:500,maxSeeds:2,checkpoint,output};
    assert.throws(/** 建立可重用成果。 */ ()=>buildGroups(options),GenerationExhaustedError);
    const before=JSON.parse(readFileSync(checkpoint,'utf8')),events=[];
    assert.throws(/** 提高目標不必改用新斷點。 */ ()=>buildGroups({...options,perCase:2,maxSeeds:3},/** 記錄續跑狀態。 */ e=>events.push(e)),GenerationExhaustedError);
    const raised=JSON.parse(readFileSync(checkpoint,'utf8'));assert.equal(raised.config.perCase,2);
    assert.deepEqual(raised.groups[0].puzzles,before.groups[0].puzzles);assert.ok(events.some(/** 原來完成組現在只需補差額。 */ e=>e.caseId==='7x7-no-singleton'&&e.status==='resume'&&e.count===1));
    const groupFile=join(output,'7x7-no-singleton.json'), exported=JSON.parse(readFileSync(groupFile,'utf8'));
    const extra=makePuzzle(5,7),payload={size:extra.size,regions:extra.regions,solution:extra.solution,givens:extra.givens,rating:extra.rating};
    const additional={...extra,id:`p-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,24)}`};
    exported.puzzles.push(additional);writeFileSync(groupFile,JSON.stringify(exported));
    assert.throws(/** 降低目標仍保留超出目標的第二題。 */ ()=>buildGroups({...options,maxSeeds:4}),GenerationExhaustedError);
    assert.deepEqual(JSON.parse(readFileSync(checkpoint,'utf8')).groups[0].puzzles,[...before.groups[0].puzzles,additional]);
    const groupPath=join(output,'7x7-no-singleton.json'),valid=readFileSync(groupPath,'utf8'),bad=JSON.parse(valid);bad.puzzles[0].regions.fill(0);writeFileSync(groupPath,JSON.stringify(bad));
    assert.throws(/** 錯誤檔案必須報錯而非重新生成覆蓋。 */ ()=>buildGroups({...options,maxSeeds:5}));assert.equal(readFileSync(groupPath,'utf8'),JSON.stringify(bad));
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
