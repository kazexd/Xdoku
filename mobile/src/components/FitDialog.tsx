import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { paginateSections, splitPage, type InfoSection } from '../game/layout';

type Props = { title: string; sections: InfoSection[]; onClose?: () => void; action?: string; onAction?: () => void };

/** 在 Modal 自己的安全區內量測可用空間，避免結果或選項被瀏海與底部遮擋。 */
export function FitDialog(props: Props) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const { fontScale } = useWindowDimensions();
  return <Modal transparent animationType="fade" onRequestClose={props.onClose ?? /** 結果畫面等待玩家選擇繼續。 */ (() => {})}>
    <SafeAreaView style={styles.safe}><View style={styles.frame} onLayout={/** 量度已扣除安全區及外邊距的實際空間。 */ ({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}>
      {bounds.width > 0 && <DialogContent key={`${bounds.width}:${bounds.height}:${fontScale}`} {...props} width={bounds.width} height={Math.min(560, bounds.height)} fontScale={fontScale} />}
    </View></SafeAreaView>
  </Modal>;
}

/** 使用固定頭尾與可分頁內容；隱藏量測文字只用於拆分，不裁切正式顯示的內容。 */
function DialogContent({ title, sections, onClose, action, onAction, width, height, fontScale }: Props & { width: number; height: number; fontScale: number }) {
  const [header, setHeader] = useState(0), [footer, setFooter] = useState(0);
  const [page, setPage] = useState(0);
  const bodyHeight = Math.max(1, height - 32 - header - footer - 16);
  const contentWidth = Math.min(400, width) - 32;
  const signature = `${bodyHeight}:${contentWidth}:${JSON.stringify(sections)}`;
  return <View accessibilityViewIsModal testID="fit-dialog" style={[styles.dialog, { width: Math.min(400, width), height }]}>
    <View style={styles.header} onLayout={/** 量度可換行的標題與關閉按鈕。 */ ({ nativeEvent: { layout } }) => setHeader(layout.height)}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{onClose && <Pressable accessibilityRole="button" accessibilityLabel="關閉選項" style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>}</View>
    <View style={styles.body}><Pages key={signature} sections={sections} width={contentWidth} height={bodyHeight} fontScale={fontScale} page={page} onCount={/** 分頁數改變時保持目前頁碼有效。 */ count => setPage(/** 只在目前頁超出範圍時調整。 */ current => Math.min(current, count - 1))} onPage={setPage} /></View>
    <View onLayout={/** 保留繼續按鈕所需的完整高度。 */ ({ nativeEvent: { layout } }) => setFooter(layout.height)}>{action && <Pressable accessibilityRole="button" style={styles.primary} onPress={onAction}><Text style={styles.primaryText}>{action}</Text></Pressable>}</View>
  </View>;
}

/** 按保守估計分頁後，使用同寬文字的實際量測修正過高的頁面。 */
function Pages({ sections, width, height, fontScale, page, onCount, onPage }: { sections: InfoSection[]; width: number; height: number; fontScale: number; page: number; onCount: (count: number) => void; onPage: (page: number) => void }) {
  const [navHeight, setNavHeight] = useState(54 * fontScale);
  const available = Math.max(1, height - navHeight);
  return <PageSet key={`${width}:${available}:${fontScale}`} sections={sections} width={width} height={available} fontScale={fontScale} page={page} onCount={onCount} onPage={onPage} onNavHeight={setNavHeight} />;
}

/** 每個文字片段量測通過才顯示，翻頁導覽始終留在內容區底部。 */
function PageSet({ sections, width, height, fontScale, page, onCount, onPage, onNavHeight }: { sections: InfoSection[]; width: number; height: number; fontScale: number; page: number; onCount: (count: number) => void; onPage: (page: number) => void; onNavHeight: (height: number) => void }) {
  const [pages, setPages] = useState(/** 依可用空間建立初始頁面。 */ () => paginateSections(sections, width, height, fontScale));
  const [measured, setMeasured] = useState<Record<string, boolean>>({});
  const current = pages[Math.min(page, pages.length - 1)];
  return <View style={styles.pageSet}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.measure}>
      {pages.map(/** 量測每一頁完整標題及內文，超高時繼續拆分。 */ (item, index) => <View key={`${index}:${item.text}`} style={{ width }} onLayout={/** 比較實際文字高度與可用高度。 */ ({ nativeEvent: { layout } }) => {
        const identity = item.title + item.text;
        if (layout.height > height + .5 && Array.from(item.text).length > 1) {
          setPages(/** 僅拆分仍存在的原片段，避免過期量測重複套用。 */ previous => { const at = previous.indexOf(item); if (at < 0) return previous; const next = [...previous.slice(0, at), ...splitPage(item), ...previous.slice(at + 1)]; return next; });
        } else setMeasured(/** 記錄成功量測，避免不必要更新。 */ previous => previous[identity] ? previous : { ...previous, [identity]: true });
      }}><Text style={styles.sectionTitle}>{item.title}</Text><Text style={styles.text}>{item.text}</Text></View>)}
    </View>
    <View style={styles.reading} testID="dialog-page">{measured[current.title + current.text] && <><Text accessibilityRole="header" style={styles.sectionTitle}>{current.title}</Text><Text style={styles.text}>{current.text}</Text></>}</View>
    <View style={styles.navigation} onLayout={/** 量度支援大字體的導覽高度，並同步頁碼上限。 */ ({ nativeEvent: { layout } }) => { onNavHeight(layout.height); onCount(pages.length); }}>
      <Pressable accessibilityRole="button" accessibilityLabel="上一頁" disabled={page <= 0} style={[styles.close, page <= 0 && styles.dim]} onPress={/** 顯示上一頁。 */ () => onPage(Math.max(0, page - 1))}><Text style={styles.closeText}>‹</Text></Pressable>
      <Text accessibilityLabel={`第 ${Math.min(page + 1, pages.length)} 頁，共 ${pages.length} 頁`} style={styles.counter}>{Math.min(page + 1, pages.length)} / {pages.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="下一頁" disabled={page >= pages.length - 1} style={[styles.close, page >= pages.length - 1 && styles.dim]} onPress={/** 顯示下一頁。 */ () => onPage(Math.min(pages.length - 1, page + 1))}><Text style={styles.closeText}>›</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#00000088' }, frame: { flex: 1, margin: 12, alignItems: 'center', justifyContent: 'center' },
  dialog: { maxHeight: 560, backgroundColor: '#faf7f0', borderRadius: 20, padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#293d34' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 12, backgroundColor: '#eeeee3' }, closeText: { fontSize: 26, color: '#435641' },
  body: { flex: 1, minHeight: 0 }, pageSet: { flex: 1 }, measure: { height: 0, overflow: 'hidden' }, reading: { flex: 1 },
  sectionTitle: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: '#435641', marginBottom: 8 }, text: { fontSize: 16, lineHeight: 25, color: '#53634e' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8 }, counter: { fontSize: 14, color: '#435641' }, dim: { opacity: .3 },
  primary: { minHeight: 44, padding: 10, backgroundColor: '#354e3e', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
