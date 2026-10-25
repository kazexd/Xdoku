import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { conflicts, dailySeed, isComplete, makePuzzle, type Mark } from '../game/engine';

const colors = ['#edc6ab', '#c9c9e9', '#bcd8be', '#f2de97', '#bad8e5'];
export default function Home() {
  const [mode, setMode] = useState<'classic' | 'daily'>('classic');
  const [level, setLevel] = useState(1);
  const [day, setDay] = useState(dailySeed());
  const [marks, setMarks] = useState<Mark[]>(Array(25).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const [tool, setTool] = useState<1 | 2>(2);
  const [loadedKey, setLoadedKey] = useState('');
  const [notice, setNotice] = useState('每列、每欄、每個色區各一隻貓；貓咪不能相鄰，包含對角線。');
  const seed = mode === 'daily' ? day : level;
  const puzzle = useMemo(() => makePuzzle(seed), [seed]);
  const key = `xdoku:v1:${mode}:${seed}`;
  const ready = loadedKey === key;
  const complete = isComplete(puzzle, marks);
  useEffect(() => { const timer = setInterval(() => setDay(dailySeed()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      setHistory([]); setMarks(Array(25).fill(0));
      if (raw) { const saved: unknown = JSON.parse(raw); if (Array.isArray(saved) && saved.length === 25 && saved.every(v => v === 0 || v === 1 || v === 2)) setMarks(saved); }
    }).catch(() => { if (active) setNotice('無法讀取進度，將開始新遊戲。'); }).finally(() => { if (active) setLoadedKey(key); });
    return () => { active = false; };
  }, [key]);
  useEffect(() => { if (ready) AsyncStorage.setItem(key, JSON.stringify(marks)).catch(() => setNotice('進度儲存失敗，請確認裝置儲存空間。')); }, [key, marks, ready]);
  function change(next: Mark[]) { setHistory(h => [...h, marks]); setMarks(next); }
  const cats = marks.flatMap((m, i) => m === 2 ? [i] : []);
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.page}>
    <View style={s.top}><Text style={s.brand}>xdoku <Text style={s.paw}>✦</Text></Text><Text style={s.tag}>一格一格，慢慢想。</Text></View>
    <View style={s.switcher}>{(['classic', 'daily'] as const).map(m => <Pressable accessibilityRole="button" key={m} onPress={() => setMode(m)} style={[s.tab, mode === m && s.selected]}><Text style={s.tabText}>{m === 'classic' ? '漫遊關卡' : '每日挑戰'}</Text></Pressable>)}</View>
    <Text style={s.eyebrow}>{mode === 'daily' ? `每日同題 · ${day} · UTC` : `小小花園 · 第 ${level} 關`}</Text>
    <Text style={s.title}>{complete ? '全都找到家了！' : '幫貓咪找個位置'}</Text>
    <Text style={s.subtitle}>{complete ? '做得好，享受這一刻的小小成就。' : `5 × 5 入門棋盤     ${cats.length} / 5 隻貓咪`}</Text>
    <View style={s.board}>{puzzle.regions.map((region, i) => {
      const bad = marks[i] === 2 && cats.some(other => i !== other && conflicts(puzzle, i, other));
      return <Pressable key={i} disabled={!ready || complete} accessibilityRole="button" accessibilityLabel={`第 ${Math.floor(i / 5) + 1} 列第 ${i % 5 + 1} 欄，區域 ${region + 1}，${marks[i] === 2 ? '貓咪' : marks[i] === 1 ? '已排除' : '空白'}`} onPress={() => change(marks.map((m, index) => index === i ? m === tool ? 0 : tool : m))} style={[s.cell, { backgroundColor: colors[region], borderRightWidth: i % 5 === 4 || puzzle.regions[i + 1] !== region ? 3 : .5, borderBottomWidth: i >= 20 || puzzle.regions[i + 5] !== region ? 3 : .5 }, bad && s.bad]}><Text style={s.symbol}>{marks[i] === 2 ? '🐱' : marks[i] === 1 ? '×' : ''}</Text></Pressable>;
    })}</View>
    <View style={s.tools}>{([2, 1] as const).map(t => <Pressable key={t} onPress={() => setTool(t)} style={[s.tool, tool === t && s.activeTool]}><Text style={s.toolText}>{t === 2 ? '🐱 放貓咪' : '× 做記號'}</Text></Pressable>)}</View>
    <View style={s.tools}><Pressable disabled={!history.length || !ready} onPress={() => { setMarks(history[history.length - 1]); setHistory(h => h.slice(0, -1)); }} style={s.action}><Text>↶ 復原</Text></Pressable><Pressable disabled={!ready || complete} onPress={() => { const cell = puzzle.solution.find(i => marks[i] !== 2); if (cell !== undefined) { change(marks.map((m, i) => i === cell ? 2 : m === 2 && conflicts(puzzle, i, cell) ? 0 : m)); setNotice('已揭示一隻貓的位置；本局使用了提示。'); } }} style={s.action}><Text>✧ 揭示一格</Text></Pressable><Pressable disabled={!ready} onPress={() => change(Array(25).fill(0))} style={s.action}><Text>重新開始</Text></Pressable></View>
    {complete && mode === 'classic' && <Pressable style={s.next} onPress={() => setLevel(v => v + 1)}><Text style={s.nextText}>下一個小花園 →</Text></Pressable>}
    <View style={s.card}><Text style={s.cardTitle}>遊玩小筆記</Text><Text style={s.note}>{notice}</Text></View>
    <View style={s.footer}><Text style={s.cardTitle}>接下來的旅程</Text><Text style={s.note}>排行榜與商店尚未開通。此開發版提供離線遊玩與本機進度儲存。</Text></View>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf7f0' }, page: { padding: 24, paddingBottom: 40, width: '100%', maxWidth: 480, alignSelf: 'center' }, top: { marginBottom: 28 }, brand: { fontSize: 30, fontWeight: '800', color: '#293d34', letterSpacing: -1 }, paw: { color: '#b57954' }, tag: { marginTop: 6, color: '#788175', fontSize: 13 }, switcher: { flexDirection: 'row', backgroundColor: '#ecece2', padding: 5, borderRadius: 16 }, tab: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' }, selected: { backgroundColor: '#fffdf8' }, tabText: { color: '#344b3d', fontWeight: '600' }, eyebrow: { marginTop: 30, color: '#8a785e', fontSize: 12, letterSpacing: 1 }, title: { marginTop: 8, color: '#293d34', fontSize: 27, fontWeight: '700' }, subtitle: { color: '#7b8074', marginTop: 10, marginBottom: 24, fontSize: 13 }, board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 3, borderColor: '#4d5749', borderRadius: 12, overflow: 'hidden' }, cell: { width: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#58604e' }, bad: { backgroundColor: '#ef8b87' }, symbol: { fontSize: 29, color: '#485448' }, tools: { flexDirection: 'row', gap: 10, marginTop: 18 }, tool: { flex: 1, alignItems: 'center', padding: 15, borderRadius: 14, backgroundColor: '#eaeade' }, activeTool: { backgroundColor: '#cddcc6', borderWidth: 1, borderColor: '#769369' }, toolText: { fontWeight: '600', color: '#2e4836' }, action: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: '#f0ede5', borderRadius: 12 }, card: { marginTop: 25, padding: 20, backgroundColor: '#eeeee3', borderRadius: 18 }, cardTitle: { fontSize: 14, fontWeight: '700', color: '#435641', marginBottom: 8 }, note: { color: '#737969', fontSize: 13, lineHeight: 22 }, footer: { marginTop: 24 }, next: { backgroundColor: '#354e3e', padding: 18, borderRadius: 14, marginTop: 20, alignItems: 'center' }, nextText: { color: 'white', fontWeight: '700' },
});
