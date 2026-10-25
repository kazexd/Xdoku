import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { conflicts, protectGivens, type Mark, type Puzzle } from '../game/engine';
import { beginStroke, cellAt, moveStroke, type Grid, type Stroke } from '../game/drag';
import { MARK_COLOR, regionColor } from '../game/palette';

const BORDER = 3;
type Props = {
  puzzle: Puzzle; marks: Mark[]; disabled: boolean; lockedCells?: number[]; errorCell?: number; errorRed?: boolean;
  onTap: (cell: number, time: number) => void;
  onStroke: (marks: Mark[]) => void;
  onInteraction: (active: boolean) => void;
  onDragStart: () => void;
};

/** 繪製正方形棋盤，管理點擊、拖曳預覽、取消與輔助動作；完成拖曳才向上層提交變更。 */
export function PuzzleBoard({ puzzle, marks, disabled, lockedCells = [], errorCell, errorRed, onTap, onStroke, onInteraction, onDragStart }: Props) {
  const grid = useRef<Grid>({ size: puzzle.size, width: 0, height: 0 });
  const stroke = useRef<Stroke | null>(null);
  const [preview, setPreview] = useState<Mark[] | null>(null);
  useEffect(/** 註冊卸載清理程序，確保離開棋盤後恢復外層捲動。 */ () => /** 元件卸載時解除棋盤互動造成的頁面捲動鎖定。 */ () => { onInteraction(false); }, [onInteraction]);
  /** 扣除棋盤外框，將觸控事件的區域座標轉為內容區座標，供格子落點判斷使用。 */
  function point(event: GestureResponderEvent) {
    return { x: event.nativeEvent.locationX - BORDER, y: event.nativeEvent.locationY - BORDER };
  }
  /** 結束觸控並恢復頁面捲動；取消時捨棄預覽，否則提交整次拖曳或交由點擊處理。 */
  function finish(cancelled = false, event?: GestureResponderEvent) {
    let current = stroke.current;
    if (current && event && !cancelled) current = moveStroke(current, point(event), grid.current);
    stroke.current = null; setPreview(null); onInteraction(false);
    if (!current || cancelled || disabled) return;
    if (current.dragging) {
      onDragStart();
      if (current.marks.some(/** 檢查是否存在符合條件的項目，以判斷衝突、變更或候選狀態。 */ (mark, i) => mark !== current.original[i])) onStroke(current.marks);
    } else if (event) {
      const cell = cellAt(current.start, grid.current);
      if (cell !== null) onTap(cell, event.nativeEvent.timestamp);
    }
  }
  const visible = protectGivens(puzzle, (preview ?? marks).map(/** 拖曳預覽亦不可擦除已選錯的格子。 */ (mark, cell) => lockedCells.includes(cell) ? 1 : mark));
  const cats = visible.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (mark, i) => mark === 2 ? [i] : []);
  return <View style={styles.board} onLayout={/** 記錄扣除外框後的棋盤尺寸，使拖曳座標與實際格子對齊。 */ ({ nativeEvent: { layout } }) => {
    grid.current = { size: puzzle.size, width: layout.width - BORDER * 2, height: layout.height - BORDER * 2 };
  }} onStartShouldSetResponder={/** 僅在棋盤可操作時接管觸控，讓棋盤處理完整手勢。 */ () => !disabled} onResponderGrant={/** 由單指起點建立筆畫快照，並暫停外層頁面的捲動。 */ event => {
    if (disabled || event.nativeEvent.touches.length !== 1) return;
    const startCell = cellAt(point(event), grid.current);
    if (startCell !== null && lockedCells.includes(startCell)) return;
    stroke.current = beginStroke(marks, point(event), grid.current);
    if (stroke.current) onInteraction(true);
  }} onResponderMove={/** 更新拖曳預覽；多指時取消，首次進入拖曳時清除雙擊狀態。 */ event => {
    if (event.nativeEvent.touches.length !== 1) { finish(true); return; }
    if (!stroke.current || disabled) return;
    const next = moveStroke(stroke.current, point(event), grid.current);
    if (next.dragging && !stroke.current.dragging) onDragStart();
    stroke.current = next;
    if (next.dragging) setPreview(next.marks);
  }} onResponderRelease={/** 最後一次更新路徑並結束手勢；仍有其他手指接觸時視為取消。 */ event => finish(event.nativeEvent.touches.length > 0, event)}
    onResponderTerminationRequest={/** 手勢進行期間保留觸控控制權，避免頁面捲動搶走拖曳。 */ () => false} onResponderTerminate={/** 系統中斷手勢時捨棄預覽並恢復頁面捲動。 */ () => finish(true)}>
    {puzzle.regions.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (region, cell) => {
      const given = puzzle.givens?.includes(cell) ?? false;
      const locked = lockedCells.includes(cell);
      const found = marks[cell] === 2 && puzzle.solution.includes(cell);
      const bad = visible[cell] === 2 && cats.some(/** 檢查是否存在符合條件的項目，以判斷衝突、變更或候選狀態。 */ other => other !== cell && conflicts(puzzle, cell, other));
      return <View key={cell} pointerEvents="none" accessible accessibilityRole="button"
        accessibilityState={{ disabled: disabled || given || locked || found }}
        accessibilityLabel={`第 ${Math.floor(cell / puzzle.size) + 1} 列第 ${cell % puzzle.size + 1} 欄，區域 ${region + 1}，${visible[cell] === 2 ? '貓咪' : visible[cell] === 1 ? '已排除' : '空白'}${errorCell === cell ? '，選錯位置' : ''}${locked ? '，已選錯，不能修改' : ''}${found && !given ? '，已找到，不能修改' : ''}${given ? '，固定線索' : ''}${bad ? '，位置衝突' : ''}`}
        accessibilityHint={found && !given ? '已找到的正確貓咪，不能修改' : locked ? '已選錯的位置，固定為排除記號' : given ? '題目預放的固定貓咪，不能修改' : '可使用動作選單切換記號或貓咪'}
        accessibilityActions={[{ name: 'mark', label: '切換記號' }, { name: 'cat', label: '切換貓咪' }]}
        onAccessibilityAction={/** 依螢幕閱讀器選擇切換記號或貓咪，並以一次可復原操作提交。 */ event => {
          if (disabled || given || locked || found) return;
          const next = marks.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (mark, i): Mark => i !== cell ? mark : event.nativeEvent.actionName === 'cat' ? mark === 2 ? 0 : 2 : mark === 1 ? 0 : mark === 2 ? 2 : 1);
          onStroke(next);
        }}
        style={[styles.cell, { width: `${100 / puzzle.size}%`, height: `${100 / puzzle.size}%`,
          left: `${cell % puzzle.size * 100 / puzzle.size}%`, top: `${Math.floor(cell / puzzle.size) * 100 / puzzle.size}%`,
          backgroundColor: errorCell === cell && errorRed ? '#791F2B' : regionColor(region),
          borderRightWidth: cell % puzzle.size === puzzle.size - 1 || puzzle.regions[cell + 1] !== region ? 3 : .5,
          borderBottomWidth: cell >= puzzle.size * (puzzle.size - 1) || puzzle.regions[cell + puzzle.size] !== region ? 3 : .5 }]}>
        <Text style={{ fontSize: Math.min(23, 180 / puzzle.size), color: MARK_COLOR, userSelect: 'none' }}>{errorCell === cell || visible[cell] === 2 ? '🐱' : visible[cell] === 1 ? '×' : ''}</Text>
        {given && <Text accessible={false} style={styles.givenBadge}>🔒</Text>}
        {bad && <View accessible={false} style={styles.conflictRing}><Text style={styles.conflictBadge}>!</Text></View>}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  board: { width: '100%', aspectRatio: 1, position: 'relative', borderWidth: BORDER, borderColor: '#4d5749', borderRadius: 12, overflow: 'hidden', ...(Platform.OS === 'web' ? { touchAction: 'none' } as ViewStyle : {}) },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderColor: '#58604e' },
  givenBadge: { position: 'absolute', top: 1, left: 1, fontSize: 9 },
  conflictRing: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderWidth: 2, borderColor: '#A51632', borderRadius: 4 },
  conflictBadge: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, textAlign: 'center', fontSize: 10, lineHeight: 12, fontWeight: '800', color: '#A51632', backgroundColor: '#FFFFFF', borderRadius: 6 },
});
