import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve('dist'), bank=JSON.parse(readFileSync('src/data/puzzles.json','utf8'));
const server=createServer(/** 提供本機匯出檔案。 */ (req,res)=>{
 let file=resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));
 if(!file.startsWith(root)||!existsSync(file)||statSync(file).isDirectory())file=resolve(root,'index.html');
 res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.wav':'audio/wav'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(/** 啟動本機伺服器。 */ done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({channel:'msedge',headless:true});
const url=`http://127.0.0.1:${server.address().port}`;
/** 檢查所有可見遊戲區及按鈕無溢出、無捲動。 */
async function fits(page){
 const bad=await page.evaluate(/** 排除隱藏文字量測與被 Modal 隱藏的底層畫面。 */ ()=>{
  const bad=[];
  for(const e of document.querySelectorAll('[data-testid="game-screen"],[data-testid="fit-dialog"],[data-testid="dialog-page"],[role="button"]')){
   if(e.closest('[aria-hidden="true"]'))continue;
   const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')continue;
   if(r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||e.scrollHeight>e.clientHeight+1)bad.push({text:e.textContent,rect:[r.x,r.y,r.width,r.height],scroll:e.scrollHeight,client:e.clientHeight});
  }
  if(document.documentElement.scrollHeight>innerHeight+1)bad.push('document scroll');return bad;
 });assert.deepEqual(bad,[]);
}
/** 閱讀全部選項分頁並確認再次開啟會回到第一頁。 */
async function options(page){
 await page.getByRole('button',{name:'開啟選項',exact:true}).click();const collected=[];
 for(let i=0;i<100;i++){
  const content=page.getByTestId('dialog-page');await content.locator('[role="heading"]').waitFor();await page.waitForTimeout(100);await fits(page);collected.push(await content.textContent());
  const next=page.getByRole('button',{name:'下一頁',exact:true});if(await next.isDisabled())break;await next.click();assert.ok(i<99);
 }
 for(const title of ['遊玩操作','規則與機會','遊玩小筆記','接下來的旅程'])assert.ok(collected.some(/** 確認主題存在。 */ t=>t.includes(title)),title);
 await page.getByRole('button',{name:'關閉選項',exact:true}).click();await page.getByRole('button',{name:'開啟選項',exact:true}).click();await page.getByTestId('dialog-page').getByText('遊玩操作',{exact:true}).waitFor();await page.getByRole('button',{name:'關閉選項',exact:true}).click();
}
try{
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932]])for(const large of [false,true]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',/** 記錄執行期錯誤。 */ error=>errors.push(error.message));await page.goto(url);await page.getByLabel('剩餘 3 次機會',{exact:true}).waitFor();
  if(large)await page.addStyleTag({content:'[data-testid="game-screen"] [dir="auto"]:not([data-testid="puzzle-board"] *), [data-testid="fit-dialog"] [dir="auto"] {font-size:24px!important;line-height:36px!important;}'});
  await page.waitForTimeout(250);const board=await page.getByTestId('puzzle-board').boundingBox();assert.ok(board.width>70);assert.ok(Math.abs(board.width-board.height)<1);assert.ok(board.width<=432);await fits(page);await options(page);
  const p=bank.classic[0],cell=p.solution[0],b=await page.locator(`[aria-label^="第 ${Math.floor(cell/p.size)+1} 列第 ${cell%p.size+1} 欄，"]`).boundingBox();
  await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(50);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.locator('[aria-label*="已找到，不能修改"]').waitFor();
  for(let i=1;i<p.size;i++)await page.getByRole('button',{name:'揭示一格',exact:true}).click();
  await page.getByText('喵～全部找到了！🎉',{exact:true}).waitFor();await page.getByTestId('dialog-page').locator('[role="heading"]').waitFor();await page.waitForTimeout(200);await fits(page);await page.getByRole('button',{name:'下一關 →',exact:true}).click();await page.getByLabel('剩餘 3 次機會',{exact:true}).waitFor();await fits(page);
  {
   const second=bank.classic[1],wrong=second.regions.flatMap(/** 收集非答案格。 */ (_,cell)=>second.solution.includes(cell)?[]:[cell]).slice(0,3);
   for(let i=0;i<3;i++){
    const c=wrong[i],target=page.locator(`[aria-label^="第 ${Math.floor(c/second.size)+1} 列第 ${c%second.size+1} 欄，"]`),r=await target.boundingBox();
    await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await page.waitForTimeout(50);await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
    await page.getByLabel(`剩餘 ${2-i} 次機會`,{exact:true}).waitFor();await page.waitForTimeout(300);assert.equal(await target.evaluate(/** 讀取錯誤動畫底色。 */ e=>getComputedStyle(e).backgroundColor),'rgb(121, 31, 43)');await page.waitForTimeout(450);
   }
   await page.getByText('Game Over',{exact:true}).waitFor();await page.getByTestId('dialog-page').locator('[role="heading"]').waitFor();await fits(page);await page.getByRole('button',{name:'開新一局',exact:true}).last().click();
   if(!large) {
   const sizes=new Set();
   for(let level=3;level<=30 && sizes.size<4;level++){
    const puzzle=bank.classic[level-1];await page.getByLabel('剩餘 3 次機會',{exact:true}).waitFor();await page.waitForTimeout(50);
    if(!sizes.has(puzzle.size)){
     const r=await page.getByTestId('puzzle-board').boundingBox();assert.ok(Math.abs(r.width-r.height)<1);await fits(page);
     const y=r.y+3+(r.height-6)/puzzle.size/2,x=r.x+3+(r.width-6)/puzzle.size/2;
     await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(r.x+r.width-3-(r.width-6)/puzzle.size/2,y,{steps:3});await page.mouse.up();
     assert.equal(await page.locator('[aria-label*="第 1 列"][aria-label*="已排除"]').count(),puzzle.size);
     await page.getByRole('button',{name:'重新開始',exact:true}).click();sizes.add(puzzle.size);
    }
    if(sizes.size<4)await page.getByRole('button',{name:'開新一局',exact:true}).click();
   }
   assert.equal(sizes.size,4);
   }
  }
  if(width===320&&!large)await page.screenshot({path:'.puzzle-generation/layout-320.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height} ${large?'large':'default'} text`);await page.close();
 }
}finally{await browser.close();await new Promise(/** 關閉本機伺服器。 */ done=>server.close(done));}
