import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { conflicts, dailySeed, isComplete, protectGivens, type Mark } from '../game/engine';
import { CLASSIC_COUNT, classicPuzzle, dailyPuzzle } from '../game/catalog';
import { applyMove, restoreRound, MAX_FISH } from '../game/lives';
import { resolveTap, type LastTap } from '../game/taps';
import { PuzzleBoard } from '../components/PuzzleBoard';

/** 管理關卡、尺寸、每日更新、本機存檔，組合遊戲主畫面與棋盤互動。 */
export default function Home() {
  const [boardInteracting, setBoardInteracting] = useState(false);
  const [mode, setMode] = useState<'classic' | 'daily'>('classic');
  const [level, setLevel] = useState(1);

  const [day, setDay] = useState(dailySeed());
  const puzzle = mode === 'daily' ? dailyPuzzle(day) : classicPuzzle(level);
  const size = puzzle.size;
  const [marks, setMarks] = useState<Mark[]>(Array(size * size).fill(0));
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
      setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setFeedback(null);
      if (freshKey.current === key) { freshKey.current = null; return; }
      if (raw) { const saved = restoreRound(puzzle, JSON.parse(raw)); setMarks(saved.marks); setFish(saved.fish); setMistakes(saved.mistakes); }
    }).catch(/** 載入失敗時清空棋盤，並顯示重新開始的訊息。 */ () => { if (active) { if (freshKey.current === key) freshKey.current = null; setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setFeedback(null); setNotice('無法讀取進度，將開始新遊戲。'); } }).finally(/** 非同步載入結束且結果仍有效時，將目前棋盤標為可操作。 */ () => { if (active) setLoadedKey(key); });
    return /** 標記本次載入已失效，避免離開棋盤後仍套用非同步結果。 */ () => { active = false; };
  }, [key, size, puzzle]);
  useEffect(/** 只在目前棋盤完成載入後儲存記號；儲存失敗時提供使用者回饋。 */ () => { if (ready) AsyncStorage.setItem(key, JSON.stringify({ marks, fish, mistakes })).catch(/** 儲存失敗時顯示訊息，讓使用者知道進度可能未寫入。 */ () => setNotice('進度儲存失敗，請確認裝置儲存空間。')); }, [key, marks, fish, mistakes, ready]);
  /** 提交棋盤變更並清除雙擊狀態，同時保護預放線索。 */
  function change(next: Mark[]) {
    if (blocked || inputLock.current) return;
    lastTap.current = null;
    const result = applyMove(puzzle, { marks, fish, mistakes }, next);
    setMarks(result.round.marks); setFish(result.round.fish); setMistakes(result.round.mistakes);
    if (result.wrong !== null) {
      inputLock.current = true; setFeedback({ key, cell: result.wrong, red: false });
      setNotice('這格沒有貓咪，扣一條魚。');
    }
  }
  /** 明確重新開始同題並恢復三條魚。 */
  function restart() { if (animating || !ready) return; lastTap.current = null; setMarks(protectGivens(puzzle)); setFish(MAX_FISH); setMistakes([]); setNotice('重新開始，三條魚已補滿。'); }
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
  const cats = marks.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (m, i) => m === 2 ? [i] : []);
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView scrollEnabled={!boardInteracting} contentContainerStyle={s.page}>
    <View style={s.top}><Text style={s.brand}>xdoku <Text style={s.paw}>✦</Text></Text><Text style={s.tag}>一格一格，慢慢想。</Text></View>
    <View style={s.switcher}>{(['classic', 'daily'] as const).map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ m => <Pressable accessibilityRole="button" key={m} onPress={/** 切換遊戲模式並重設載入與雙擊狀態，避免沿用另一模式的進度。 */ () => { if (m !== mode) { lastTap.current = null; setLoadedKey(''); setMode(m); } }} style={[s.tab, mode === m && s.selected]}><Text style={s.tabText}>{m === 'classic' ? '漫遊關卡' : '每日挑戰'}</Text></Pressable>)}</View>
    <Text style={s.eyebrow}>{mode === 'daily' ? `每日同題 · ${day} · UTC` : `小小花園 · 第 ${level} 關`}</Text>
    <Text style={s.title}>{complete ? '全都找到家了！' : '幫貓咪找個位置'}</Text>
    <Text style={s.subtitle}>{complete ? '做得好，享受這一刻的小小成就。' : `${size} × ${size} · ${{ easy: '簡單', medium: '中等', hard: '困難' }[puzzle.rating!.difficulty]}     ${ready ? cats.length : 0} / ${size} 隻貓咪`}</Text>
    <Text accessibilityLabel={`剩餘 ${ready ? fish : MAX_FISH} 次機會`} style={s.fish}>{Array.from({ length: MAX_FISH }, /** 顯示剩餘與已消耗的魚。 */ (_, i) => <Text key={i} style={{ opacity: i < fish ? 1 : .2 }}>🐟 </Text>)}</Text>
    <PuzzleBoard key={key} lockedCells={mistakes} puzzle={puzzle} marks={marks} errorCell={animating ? feedback.cell : undefined} errorRed={animating && feedback.red} disabled={blocked} onTap={tapCell} onStroke={change} onInteraction={setBoardInteracting} onDragStart={/** 開始拖曳時清除前一次點擊，避免下一次點擊被誤判為雙擊。 */ () => { lastTap.current = null; }} />
    {(puzzle.givens?.length ?? 0) > 0 && <Text style={s.gestureHint}>🔒 為題目預放線索，不能移除，也不計作使用提示。</Text>}
    <Text style={s.gestureHint}>點一下做記號 ×　·　連按兩下放貓咪 🐱。拖曳可快速標記；從已有記號的格子開始拖曳可清除。</Text>
    <View style={s.tools}><Pressable accessibilityRole="button" disabled={!ready || boardInteracting || level >= CLASSIC_COUNT} onPress={startNewGame} style={s.action}><Text>{level >= CLASSIC_COUNT ? '題庫已用完' : '開新一局'}</Text></Pressable><Pressable disabled={blocked} onPress={/** 揭示尚未放置的答案格，清除與該位置衝突的貓咪並提示本局已使用協助。 */ () => { const cell = puzzle.solution.find(/** 取得第一個符合條件的候選格或群組。 */ i => marks[i] !== 2); if (cell !== undefined) { change(marks.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (m, i) => i === cell ? 2 : m === 2 && conflicts(puzzle, i, cell) ? 0 : m)); setNotice('已揭示一隻貓的位置；本局使用了提示。'); } }} style={s.action}><Text>✧ 揭示一格</Text></Pressable><Pressable disabled={!ready || animating || gameOver} onPress={restart} style={s.action}><Text>重新開始</Text></Pressable></View>
    <View style={s.card}><Text style={s.cardTitle}>遊玩小筆記</Text><Text style={s.note}>{notice}</Text></View>
    <View style={s.footer}><Text style={s.cardTitle}>接下來的旅程</Text><Text style={s.note}>排行榜與商店尚未開通。目前內建 {CLASSIC_COUNT} 個一般關卡，可離線遊玩並儲存進度。</Text></View>
  </ScrollView><Modal visible={gameOver} transparent animationType="fade" onRequestClose={/** 機會用盡後保留結束畫面。 */ () => {}}>
    <View style={s.overlay}><View accessibilityViewIsModal style={s.dialog}><Text style={s.title}>Game Over</Text><Text style={s.note}>三條魚已用完，再挑戰一局吧。</Text><Pressable accessibilityRole="button" onPress={level < CLASSIC_COUNT ? startNewGame : restart} style={s.next}><Text style={s.nextText}>{level < CLASSIC_COUNT ? '開新一局' : '重新挑戰本關'}</Text></Pressable></View></View>
  </Modal></SafeAreaView>;
}
const s = StyleSheet.create({
  fish: { fontSize: 26, textAlign: 'center', marginBottom: 16 },
  overlay: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 28 },
  dialog: { backgroundColor: '#faf7f0', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380 },
  gestureHint: { marginTop: 18, textAlign: 'center', color: '#435641', fontSize: 13 },
  safe: { flex: 1, backgroundColor: '#faf7f0' }, page: { padding: 24, paddingBottom: 40, width: '100%', maxWidth: 480, alignSelf: 'center' }, top: { marginBottom: 28 }, brand: { fontSize: 30, fontWeight: '800', color: '#293d34', letterSpacing: -1 }, paw: { color: '#b57954' }, tag: { marginTop: 6, color: '#788175', fontSize: 13 }, switcher: { flexDirection: 'row', backgroundColor: '#ecece2', padding: 5, borderRadius: 16 }, tab: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' }, selected: { backgroundColor: '#fffdf8' }, tabText: { color: '#344b3d', fontWeight: '600' }, eyebrow: { marginTop: 30, color: '#8a785e', fontSize: 12, letterSpacing: 1 }, title: { marginTop: 8, color: '#293d34', fontSize: 27, fontWeight: '700' }, subtitle: { color: '#7b8074', marginTop: 10, marginBottom: 24, fontSize: 13 }, board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 3, borderColor: '#4d5749', borderRadius: 12, overflow: 'hidden' }, cell: { width: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#58604e' }, bad: { backgroundColor: '#ef8b87' }, symbol: { fontSize: 29, color: '#485448' }, tools: { flexDirection: 'row', gap: 10, marginTop: 18 }, tool: { flex: 1, alignItems: 'center', padding: 15, borderRadius: 14, backgroundColor: '#eaeade' }, activeTool: { backgroundColor: '#cddcc6', borderWidth: 1, borderColor: '#769369' }, toolText: { fontWeight: '600', color: '#2e4836' }, action: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: '#f0ede5', borderRadius: 12 }, card: { marginTop: 25, padding: 20, backgroundColor: '#eeeee3', borderRadius: 18 }, cardTitle: { fontSize: 14, fontWeight: '700', color: '#435641', marginBottom: 8 }, note: { color: '#737969', fontSize: 13, lineHeight: 22 }, footer: { marginTop: 24 }, next: { backgroundColor: '#354e3e', padding: 18, borderRadius: 14, marginTop: 20, alignItems: 'center' }, nextText: { color: 'white', fontWeight: '700' },
});
