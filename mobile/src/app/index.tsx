import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { BOARD_SIZES, conflicts, dailySeed, isComplete, levelPuzzle, makePuzzle, type Mark } from '../game/engine';
import { resolveTap, type LastTap } from '../game/taps';
import { PuzzleBoard } from '../components/PuzzleBoard';

/** 管理關卡、尺寸、每日更新、本機存檔及復原歷史，組合遊戲主畫面與棋盤互動。 */
export default function Home() {
  const [boardInteracting, setBoardInteracting] = useState(false);
  const [mode, setMode] = useState<'classic' | 'daily'>('classic');
  const [level, setLevel] = useState(1);
  const [size, setSize] = useState<number>(5);
  const [day, setDay] = useState(dailySeed());
  const [marks, setMarks] = useState<Mark[]>(Array(size * size).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const lastTap = useRef<LastTap | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [notice, setNotice] = useState('每列、每欄、每個色區各一隻貓；貓咪不能相鄰，包含對角線。');
  const seed = mode === 'daily' ? day : level;
  const puzzle = useMemo(/** 依目前模式、種子與尺寸取得棋盤，僅在相關依賴改變時重新計算。 */ () => mode === 'daily' ? makePuzzle(seed, size) : levelPuzzle(level, size), [seed, size, mode, level]);
  const key = `xdoku:${mode}:${puzzle.id}`;
  const ready = loadedKey === key;
  const complete = ready && isComplete(puzzle, marks);
  useEffect(/** 定期檢查 UTC 日期是否變更，並在元件卸載時清除計時器。 */ () => { const timer = setInterval(/** 重新取得 UTC 每日種子，使跨日後的每日棋盤更新。 */ () => setDay(dailySeed()), 30000); return /** 元件卸載時停止日期輪詢，避免計時器持續執行。 */ () => clearInterval(timer); }, []);
  useEffect(/** 載入並驗證目前棋盤存檔；以清理旗標防止過期的非同步結果覆蓋新棋盤。 */ () => {
    let active = true;
    AsyncStorage.getItem(key).then(/** 忽略已失效的載入結果，重設復原歷史並套用尺寸與記號值皆合法的存檔。 */ raw => {
      if (!active) return;
      setHistory([]); setMarks(Array(size * size).fill(0));
      if (raw) { const saved: unknown = JSON.parse(raw); if (Array.isArray(saved) && saved.length === size * size && saved.every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ v => v === 0 || v === 1 || v === 2)) setMarks(saved); }
    }).catch(/** 載入失敗時清空棋盤及歷史，並顯示重新開始的訊息。 */ () => { if (active) { setHistory([]); setMarks(Array(size * size).fill(0)); setNotice('無法讀取進度，將開始新遊戲。'); } }).finally(/** 非同步載入結束且結果仍有效時，將目前棋盤標為可操作。 */ () => { if (active) setLoadedKey(key); });
    return /** 標記本次載入已失效，避免離開棋盤後仍套用非同步結果。 */ () => { active = false; };
  }, [key, size]);
  useEffect(/** 只在目前棋盤完成載入後儲存記號；儲存失敗時提供使用者回饋。 */ () => { if (ready) AsyncStorage.setItem(key, JSON.stringify(marks)).catch(/** 儲存失敗時顯示訊息，讓使用者知道進度可能未寫入。 */ () => setNotice('進度儲存失敗，請確認裝置儲存空間。')); }, [key, marks, ready]);
  /** 提交一次棋盤變更，保存變更前快照供復原，並清除尚待判定的雙擊狀態。 */
  function change(next: Mark[]) { lastTap.current = null; setHistory(/** 將變更前的棋盤附加至復原歷史。 */ h => [...h, marks]); setMarks(next); }
  /** 依點擊時間判定單擊／雙擊，更新指定格子，避免雙擊額外新增一筆復原紀錄。 */
  function tapCell(cell: number, time: number) {
    const result = resolveTap(marks[cell], cell, time, key, lastTap.current);
    lastTap.current = result.lastTap;
    if (!result.replaceMove) setHistory(/** 將變更前的棋盤附加至復原歷史。 */ h => [...h, marks]);
    setMarks(marks.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (mark, i) => i === cell ? result.mark : mark));
  }
  const cats = marks.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (m, i) => m === 2 ? [i] : []);
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView scrollEnabled={!boardInteracting} contentContainerStyle={s.page}>
    <View style={s.top}><Text style={s.brand}>xdoku <Text style={s.paw}>✦</Text></Text><Text style={s.tag}>一格一格，慢慢想。</Text></View>
    <View style={s.switcher}>{(['classic', 'daily'] as const).map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ m => <Pressable accessibilityRole="button" key={m} onPress={/** 切換遊戲模式並重設載入與雙擊狀態，避免沿用另一模式的進度。 */ () => { if (m !== mode) { lastTap.current = null; setLoadedKey(''); setMode(m); } }} style={[s.tab, mode === m && s.selected]}><Text style={s.tabText}>{m === 'classic' ? '漫遊關卡' : '每日挑戰'}</Text></Pressable>)}</View>
    <View style={s.tools}>{BOARD_SIZES.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: size === value }} onPress={/** 切換棋盤尺寸並等待對應進度載入，避免舊尺寸資料套用到新棋盤。 */ () => { if (value !== size) { lastTap.current = null; setLoadedKey(''); setSize(value); } }} style={[s.tab, size === value && s.selected]}><Text style={s.tabText}>{value} × {value}</Text></Pressable>)}</View>
    <Text style={s.eyebrow}>{mode === 'daily' ? `每日同題 · ${day} · UTC` : `小小花園 · 第 ${level} 關`}</Text>
    <Text style={s.title}>{complete ? '全都找到家了！' : '幫貓咪找個位置'}</Text>
    <Text style={s.subtitle}>{complete ? '做得好，享受這一刻的小小成就。' : `${size} × ${size} · ${{ easy: '簡單', medium: '中等', hard: '困難' }[puzzle.rating!.difficulty]}     ${ready ? cats.length : 0} / ${size} 隻貓咪`}</Text>
    <PuzzleBoard key={key} puzzle={puzzle} marks={marks} disabled={!ready || complete} onTap={tapCell} onStroke={change} onInteraction={setBoardInteracting} onDragStart={/** 開始拖曳時清除前一次點擊，避免下一次點擊被誤判為雙擊。 */ () => { lastTap.current = null; }} />
    <Text style={s.gestureHint}>點一下做記號 ×　·　連按兩下放貓咪 🐱。拖曳可快速標記；從已有記號的格子開始拖曳可清除。</Text>
    <View style={s.tools}><Pressable disabled={!history.length || !ready} onPress={/** 恢復上一份棋盤快照並移除該筆歷史，同時清除雙擊狀態。 */ () => { lastTap.current = null; setMarks(history[history.length - 1]); setHistory(/** 移除已復原的最後一份歷史快照。 */ h => h.slice(0, -1)); }} style={s.action}><Text>↶ 復原</Text></Pressable><Pressable disabled={!ready || complete} onPress={/** 揭示尚未放置的答案格，清除與該位置衝突的貓咪並提示本局已使用協助。 */ () => { const cell = puzzle.solution.find(/** 取得第一個符合條件的候選格或群組。 */ i => marks[i] !== 2); if (cell !== undefined) { change(marks.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (m, i) => i === cell ? 2 : m === 2 && conflicts(puzzle, i, cell) ? 0 : m)); setNotice('已揭示一隻貓的位置；本局使用了提示。'); } }} style={s.action}><Text>✧ 揭示一格</Text></Pressable><Pressable disabled={!ready} onPress={/** 將棋盤重設為空白，並保留一筆可復原的操作紀錄。 */ () => change(Array(size * size).fill(0))} style={s.action}><Text>重新開始</Text></Pressable></View>
    {complete && mode === 'classic' && <Pressable style={s.next} onPress={/** 前往下一關，清除雙擊與已載入識別以重新讀取進度。 */ () => { lastTap.current = null; setLoadedKey(''); setLevel(/** 將一般關卡編號遞增一關。 */ v => v + 1); }}><Text style={s.nextText}>下一個小花園 →</Text></Pressable>}
    <View style={s.card}><Text style={s.cardTitle}>遊玩小筆記</Text><Text style={s.note}>{notice}</Text></View>
    <View style={s.footer}><Text style={s.cardTitle}>接下來的旅程</Text><Text style={s.note}>排行榜與商店尚未開通。此開發版提供離線遊玩與本機進度儲存。</Text></View>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  gestureHint: { marginTop: 18, textAlign: 'center', color: '#435641', fontSize: 13 },
  safe: { flex: 1, backgroundColor: '#faf7f0' }, page: { padding: 24, paddingBottom: 40, width: '100%', maxWidth: 480, alignSelf: 'center' }, top: { marginBottom: 28 }, brand: { fontSize: 30, fontWeight: '800', color: '#293d34', letterSpacing: -1 }, paw: { color: '#b57954' }, tag: { marginTop: 6, color: '#788175', fontSize: 13 }, switcher: { flexDirection: 'row', backgroundColor: '#ecece2', padding: 5, borderRadius: 16 }, tab: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' }, selected: { backgroundColor: '#fffdf8' }, tabText: { color: '#344b3d', fontWeight: '600' }, eyebrow: { marginTop: 30, color: '#8a785e', fontSize: 12, letterSpacing: 1 }, title: { marginTop: 8, color: '#293d34', fontSize: 27, fontWeight: '700' }, subtitle: { color: '#7b8074', marginTop: 10, marginBottom: 24, fontSize: 13 }, board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 3, borderColor: '#4d5749', borderRadius: 12, overflow: 'hidden' }, cell: { width: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#58604e' }, bad: { backgroundColor: '#ef8b87' }, symbol: { fontSize: 29, color: '#485448' }, tools: { flexDirection: 'row', gap: 10, marginTop: 18 }, tool: { flex: 1, alignItems: 'center', padding: 15, borderRadius: 14, backgroundColor: '#eaeade' }, activeTool: { backgroundColor: '#cddcc6', borderWidth: 1, borderColor: '#769369' }, toolText: { fontWeight: '600', color: '#2e4836' }, action: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: '#f0ede5', borderRadius: 12 }, card: { marginTop: 25, padding: 20, backgroundColor: '#eeeee3', borderRadius: 18 }, cardTitle: { fontSize: 14, fontWeight: '700', color: '#435641', marginBottom: 8 }, note: { color: '#737969', fontSize: 13, lineHeight: 22 }, footer: { marginTop: 24 }, next: { backgroundColor: '#354e3e', padding: 18, borderRadius: 14, marginTop: 20, alignItems: 'center' }, nextText: { color: 'white', fontWeight: '700' },
});
