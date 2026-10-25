import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { conflicts, dailySeed, isComplete, protectGivens, type Mark } from '../game/engine';
import { CLASSIC_COUNT, classicPuzzle, dailyPuzzle } from '../game/catalog';
import { applyMove, restoreRound, MAX_FISH } from '../game/lives';
import { newlyFoundCat } from '../game/sound';
import { useCorrectSound } from '../game/useCorrectSound';
import { resolveTap, type LastTap } from '../game/taps';
import { screenLayout } from '../game/layout';
import { FitDialog } from '../components/FitDialog';
import { Confetti } from '../components/Confetti';
import { PuzzleBoard } from '../components/PuzzleBoard';

/** 管理關卡、尺寸、每日更新、本機存檔，組合遊戲主畫面與棋盤互動。 */
export default function Home() {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [headerHeight, setHeaderHeight] = useState(0), [footerHeight, setFooterHeight] = useState(0);
  const layout = screenLayout(bounds.width, bounds.height, headerHeight, footerHeight);
  const playCorrectSound = useCorrectSound();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [boardInteracting, setBoardInteracting] = useState(false);
  const [mode, setMode] = useState<'classic' | 'daily'>('classic');
  const [level, setLevel] = useState(1);

  const [day, setDay] = useState(dailySeed());
  const puzzle = mode === 'daily' ? dailyPuzzle(day) : classicPuzzle(level);
  const size = puzzle.size;
  const [marks, setMarks] = useState<Mark[]>(Array(size * size).fill(0));
  const [usedHint, setUsedHint] = useState(false);
  const [lastCat, setLastCat] = useState<number | undefined>();
  const [celebratedKey, setCelebratedKey] = useState('');
  const [dismissedKey, setDismissedKey] = useState('');
  const [mistakes, setMistakes] = useState<number[]>([]);
  const [fish, setFish] = useState(MAX_FISH);
  const [feedback, setFeedback] = useState<{ key: string; cell: number; red: boolean } | null>(null);
  const inputLock = useRef(false);
  const lastTap = useRef<LastTap | null>(null);
  const freshKey = useRef<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [notice, setNotice] = useState('每列、每欄、每個色區各一隻貓；貓咪不能相鄰，包含對角線。');
  const key = mode === 'daily' ? `xdoku:daily:${day}:${puzzle.id}` : `xdoku:classic:${puzzle.id}`;
  const ready = loadedKey === key;
  const complete = ready && isComplete(puzzle, marks);
  useEffect(/** 完成後保留一秒慶祝，之後才顯示結果彈窗。 */ () => {
    if (!complete) return;
    const timer = setTimeout(/** 顯示目前題目的過關結果。 */ () => setCelebratedKey(key), 1000);
    return /** 題目切換或重玩時取消過期結果。 */ () => clearTimeout(timer);
  }, [complete, key]);
  const animating = feedback?.key === key;
  const gameOver = ready && fish === 0 && !animating;
  const blocked = !ready || complete || fish === 0 || animating;
  useEffect(/** 分階段顯示錯誤貓、暗紅色及排除記號，切換棋盤時取消舊計時器。 */ () => {
    if (!feedback || feedback.key !== key) { inputLock.current = false; return; }
    const timer = setTimeout(/** 推進錯誤回饋階段。 */ () => {
      if (!feedback.red) setFeedback({ ...feedback, red: true });
      else { setFeedback(null); inputLock.current = false; }
    }, feedback.red ? 450 : 250);
    return /** 清除過期動畫。 */ () => clearTimeout(timer);
  }, [feedback, key]);
  useEffect(/** 定期檢查 UTC 日期是否變更，並在元件卸載時清除計時器。 */ () => { const timer = setInterval(/** 重新取得 UTC 每日種子，使跨日後的每日棋盤更新。 */ () => setDay(dailySeed()), 30000); return /** 元件卸載時停止日期輪詢，避免計時器持續執行。 */ () => clearInterval(timer); }, []);
  useEffect(/** 載入並驗證目前棋盤存檔；以清理旗標防止過期的非同步結果覆蓋新棋盤。 */ () => {
    let active = true;
    AsyncStorage.getItem(key).then(/** 忽略已失效的載入結果，套用尺寸與記號值皆合法的存檔。 */ raw => {
      if (!active) return;
      setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setUsedHint(false); setLastCat(undefined); setDismissedKey(''); setCelebratedKey(''); setFeedback(null);
      if (freshKey.current === key) { freshKey.current = null; return; }
      if (raw) { const data = JSON.parse(raw); const saved = restoreRound(puzzle, data); setUsedHint(data?.usedHint === true); setMarks(saved.marks); setFish(saved.fish); setMistakes(saved.mistakes); }
    }).catch(/** 載入失敗時清空棋盤，並顯示重新開始的訊息。 */ () => { if (active) { if (freshKey.current === key) freshKey.current = null; setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setUsedHint(false); setLastCat(undefined); setDismissedKey(''); setCelebratedKey(''); setFeedback(null); setNotice('無法讀取進度，將開始新遊戲。'); } }).finally(/** 非同步載入結束且結果仍有效時，將目前棋盤標為可操作。 */ () => { if (active) setLoadedKey(key); });
    return /** 標記本次載入已失效，避免離開棋盤後仍套用非同步結果。 */ () => { active = false; };
  }, [key, size, puzzle]);
  useEffect(/** 只在目前棋盤完成載入後儲存記號；儲存失敗時提供使用者回饋。 */ () => { if (ready) AsyncStorage.setItem(key, JSON.stringify({ marks, fish, mistakes, usedHint })).catch(/** 儲存失敗時顯示訊息，讓使用者知道進度可能未寫入。 */ () => setNotice('進度儲存失敗，請確認裝置儲存空間。')); }, [key, marks, fish, mistakes, usedHint, ready]);
  /** 提交棋盤變更並清除雙擊狀態，同時保護預放線索。 */
  function change(next: Mark[]) {
    if (blocked || inputLock.current) return;
    lastTap.current = null;
    const result = applyMove(puzzle, { marks, fish, mistakes }, next);
    const found = newlyFoundCat(puzzle, marks, result.round.marks);
    if (found >= 0) { setLastCat(found); playCorrectSound(); }
    setMarks(result.round.marks); setFish(result.round.fish); setMistakes(result.round.mistakes);
    if (result.wrong !== null) {
      inputLock.current = true; setFeedback({ key, cell: result.wrong, red: false });
      setNotice('這格沒有貓咪，扣一條魚。');
    }
  }
  /** 明確重新開始同題並恢復三條魚。 */
  function restart() { if (animating || !ready) return; lastTap.current = null; setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setUsedHint(false); setLastCat(undefined); setDismissedKey(''); setCelebratedKey(''); setNotice('重新開始，三條魚已補滿。'); }
  /** 依點擊時間判定單擊／雙擊，更新指定格子，讓第二下正確取代第一下的記號。 */
  function tapCell(cell: number, time: number) {
    if (blocked || inputLock.current) return;
    if (mistakes.includes(cell) || (marks[cell] === 2 && puzzle.solution.includes(cell)) || puzzle.givens?.includes(cell)) { lastTap.current = null; return; }
    const result = resolveTap(marks[cell], cell, time, key, lastTap.current);
    change(marks.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (mark, i) => i === cell ? result.mark : mark));
    lastTap.current = result.mark === 2 ? null : result.lastTap;
  }
  /** 開新一局時前往下一個一般關卡，清除雙擊、載入及提示訊息，保留每日挑戰原題與存檔。 */
  function startNewGame() {
    if (level >= CLASSIC_COUNT) { setNotice('已到達內建題庫最後一關，請等待後續題庫更新。'); return; }
    setFeedback(null); inputLock.current = false;
    const nextLevel = level + 1;
    freshKey.current = `xdoku:classic:${classicPuzzle(nextLevel).id}`;
    lastTap.current = null;
    setLoadedKey('');
    setMode('classic');
    setLevel(nextLevel);
    setNotice('每列、每欄、每個色區各一隻貓；貓咪不能相鄰，包含對角線。');
  }
  /** 揭示一隻正確貓咪，保留提示紀錄與現有機會。 */
  function reveal() {
    if (blocked) return;
    const cell = puzzle.solution.find(/** 取得第一隻尚未找到的貓咪。 */ i => marks[i] !== 2);
    if (cell === undefined) return;
    change(marks.map(/** 新增提示貓並移除衝突的貓咪。 */ (mark, i) => i === cell ? 2 : mark === 2 && conflicts(puzzle, i, cell) ? 0 : mark));
    setUsedHint(true); setNotice('已揭示一隻貓的位置；本局使用了提示。');
  }
  /** 保留成果直到玩家繼續，每日挑戰完成後回到漫遊模式。 */
  function continueGame() {
    if (level < CLASSIC_COUNT) startNewGame();
    else if (mode === 'daily') { lastTap.current = null; setLoadedKey(''); setMode('classic'); }
    else setDismissedKey(key);
  }
  const cats = marks.filter(/** 統計已找到的貓咪。 */ mark => mark === 2).length;
  const optionsSections = [
    { title: '遊玩操作', text: '點一下做記號 ×，連按兩下放貓咪 🐱。拖曳可快速標記；從已有記號的格子開始拖曳可清除。已找到的正確貓咪與選錯後的 X 都會鎖定，不能修改；重新開始或開新一局才會清除。' },
    { title: '規則與機會', text: '每列、每欄、每個色區各一隻貓；貓咪不能相鄰，包含對角線。每局三條魚，放錯貓會扣一條；用完後顯示 Game Over。提示不扣魚，但會記錄使用提示。重新開始會重設同題及三條魚。🔒 為題目固定線索，不能移除，也不計作提示。' },
    { title: '遊玩小筆記', text: notice },
    { title: '接下來的旅程', text: `排行榜與商店尚未開通。目前內建 ${CLASSIC_COUNT} 個一般關卡，可離線遊玩並儲存進度。` },
  ];
  return <SafeAreaView style={s.safe}><StatusBar style="dark" />
    <View testID="game-screen" style={[s.page, { padding: layout.padding, gap: layout.gap }]} onLayout={/** 量度安全區內實際可用空間，不再次扣除瀏海或底部。 */ ({ nativeEvent: { layout: measured } }) => setBounds({ width: measured.width, height: measured.height })}>
      <View style={[s.header, { gap: layout.gap }]} onLayout={/** 固定資訊可隨字體換行，再將剩餘高度交給棋盤。 */ ({ nativeEvent: { layout: measured } }) => setHeaderHeight(measured.height)}>
        <View style={s.top}><Text style={s.brand}>xdoku <Text style={s.paw}>✦</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="開啟選項" accessibilityState={{ expanded: optionsOpen }} disabled={boardInteracting} onPress={/** 每次開啟選項都由第一頁開始。 */ () => { lastTap.current = null; setOptionsOpen(true); }} style={s.optionsButton}><Text style={s.optionsIcon}>⚙</Text></Pressable></View>
        <View style={s.switcher}>{(['classic', 'daily'] as const).map(/** 切換模式並載入各自儲存的進度。 */ nextMode => <Pressable accessibilityRole="button" key={nextMode} disabled={boardInteracting} onPress={/** 清除雙擊及舊載入狀態。 */ () => { if (nextMode !== mode) { lastTap.current = null; setLoadedKey(''); setMode(nextMode); } }} style={[s.tab, mode === nextMode && s.selected]}><Text style={s.tabText}>{nextMode === 'classic' ? '漫遊關卡' : '每日挑戰'}</Text></Pressable>)}</View>
        <View style={s.infoRow}><Text style={s.info}>{mode === 'daily' ? `每日 · ${day} UTC` : `第 ${level} 關`} · {size}×{size} · ${{ easy: '簡單', medium: '中等', hard: '困難' }[puzzle.rating!.difficulty]}</Text><Text accessibilityLabel={`已找到 ${ready ? cats : 0} 隻，共 ${size} 隻貓咪`} style={s.info}>🐱 {ready ? cats : 0}/{size}</Text></View>
        <Text accessibilityLabel={`剩餘 ${ready ? fish : MAX_FISH} 次機會`} style={s.fish}>{Array.from({ length: MAX_FISH }, /** 已消耗的魚保留淡色位置。 */ (_, i) => <Text key={i} style={{ opacity: i < fish ? 1 : .2 }}>🐟 </Text>)}</Text>
      </View>
      <View style={s.arena}><View testID="board-frame" style={{ width: layout.board, height: layout.board, position: 'relative' }}><PuzzleBoard key={key} celebrateCell={complete ? lastCat : undefined} lockedCells={mistakes} puzzle={puzzle} marks={marks} errorCell={animating ? feedback.cell : undefined} errorRed={animating && feedback.red} disabled={blocked || optionsOpen} onTap={tapCell} onStroke={change} onInteraction={setBoardInteracting} onDragStart={/** 開始拖曳時取消雙擊判斷。 */ () => { lastTap.current = null; }} />{complete && celebratedKey !== key && <Confetti key={key} />}</View></View>
      <View style={s.tools} onLayout={/** 保留完整操作按鈕高度，包含系統放大的字體。 */ ({ nativeEvent: { layout: measured } }) => setFooterHeight(measured.height)}>
        <Pressable accessibilityRole="button" disabled={!ready || boardInteracting || level >= CLASSIC_COUNT} onPress={startNewGame} style={s.action}><Text style={s.actionText}>{level >= CLASSIC_COUNT ? '題庫已用完' : '開新一局'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={blocked || boardInteracting} onPress={reveal} style={s.action}><Text style={s.actionText}>揭示一格</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!ready || animating || gameOver || boardInteracting} onPress={restart} style={s.action}><Text style={s.actionText}>重新開始</Text></Pressable>
      </View>
    </View>
    {gameOver && <FitDialog title="Game Over" sections={[{ title: '三條魚已用完', text: '再挑戰一局吧。' }]} action={level < CLASSIC_COUNT ? '開新一局' : '重新挑戰本關'} onAction={level < CLASSIC_COUNT ? startNewGame : restart} />}
    {complete && celebratedKey === key && dismissedKey !== key && <FitDialog title="喵～全部找到了！🎉" sections={[{ title: mode === 'daily' ? '每日挑戰完成' : level === CLASSIC_COUNT ? '所有關卡已完成！' : `第 ${level} 關完成`, text: `貓咪都找到家了。\n剩餘機會 ${'🐟'.repeat(fish)}${usedHint ? '\n本關使用了提示' : ''}` }]} action={mode === 'daily' ? '繼續漫遊關卡' : level === CLASSIC_COUNT ? '查看完成棋盤' : '下一關 →'} onAction={continueGame} />}
    {optionsOpen && <FitDialog title="選項" sections={optionsSections} onClose={/** 關閉選項後回到同一局。 */ () => setOptionsOpen(false)} />}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf7f0' }, page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' }, header: { flexShrink: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, brand: { flexShrink: 1, fontSize: 26, fontWeight: '800', color: '#293d34' }, paw: { color: '#b57954' },
  optionsButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 14, backgroundColor: '#eeeee3' }, optionsIcon: { fontSize: 26, color: '#435641' },
  switcher: { flexDirection: 'row', backgroundColor: '#ecece2', padding: 4, borderRadius: 14 }, tab: { flex: 1, minHeight: 44, padding: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, selected: { backgroundColor: '#fffdf8' }, tabText: { fontSize: 14, color: '#344b3d', fontWeight: '600', textAlign: 'center' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, rowGap: 2 }, info: { fontSize: 13, color: '#53634e', flexShrink: 1 }, fish: { fontSize: 22, textAlign: 'center' },
  arena: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }, tools: { flexDirection: 'row', gap: 6, flexShrink: 0 }, action: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 6, backgroundColor: '#f0ede5', borderRadius: 12 }, actionText: { fontSize: 13, color: '#344b3d', textAlign: 'center' },
});
