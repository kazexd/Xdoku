import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { conflicts, type Mark, type Puzzle } from '../game/engine';
import { beginStroke, cellAt, moveStroke, type Grid, type Stroke } from '../game/drag';

const colors = ['#edc6ab', '#c9c9e9', '#bcd8be', '#f2de97', '#bad8e5', '#e4bcce', '#d3d7a6'];
const BORDER = 3;
type Props = {
  puzzle: Puzzle; marks: Mark[]; disabled: boolean;
  onTap: (cell: number, time: number) => void;
  onStroke: (marks: Mark[]) => void;
  onInteraction: (active: boolean) => void;
  onDragStart: () => void;
};

export function PuzzleBoard({ puzzle, marks, disabled, onTap, onStroke, onInteraction, onDragStart }: Props) {
  const grid = useRef<Grid>({ size: puzzle.size, width: 0, height: 0 });
  const stroke = useRef<Stroke | null>(null);
  const [preview, setPreview] = useState<Mark[] | null>(null);
  useEffect(() => () => { onInteraction(false); }, [onInteraction]);
  function point(event: GestureResponderEvent) {
    return { x: event.nativeEvent.locationX - BORDER, y: event.nativeEvent.locationY - BORDER };
  }
  function finish(cancelled = false, event?: GestureResponderEvent) {
    let current = stroke.current;
    if (current && event && !cancelled) current = moveStroke(current, point(event), grid.current);
    stroke.current = null; setPreview(null); onInteraction(false);
    if (!current || cancelled || disabled) return;
    if (current.dragging) {
      onDragStart();
      if (current.marks.some((mark, i) => mark !== current.original[i])) onStroke(current.marks);
    } else if (event) {
      const cell = cellAt(current.start, grid.current);
      if (cell !== null) onTap(cell, event.nativeEvent.timestamp);
    }
  }
  const visible = preview ?? marks;
  const cats = visible.flatMap((mark, i) => mark === 2 ? [i] : []);
  return <View style={styles.board} onLayout={({ nativeEvent: { layout } }) => {
    grid.current = { size: puzzle.size, width: layout.width - BORDER * 2, height: layout.height - BORDER * 2 };
  }} onStartShouldSetResponder={() => !disabled} onResponderGrant={event => {
    if (disabled || event.nativeEvent.touches.length !== 1) return;
    stroke.current = beginStroke(marks, point(event), grid.current);
    if (stroke.current) onInteraction(true);
  }} onResponderMove={event => {
    if (event.nativeEvent.touches.length !== 1) { finish(true); return; }
    if (!stroke.current || disabled) return;
    const next = moveStroke(stroke.current, point(event), grid.current);
    if (next.dragging && !stroke.current.dragging) onDragStart();
    stroke.current = next;
    if (next.dragging) setPreview(next.marks);
  }} onResponderRelease={event => finish(event.nativeEvent.touches.length > 0, event)}
    onResponderTerminationRequest={() => false} onResponderTerminate={() => finish(true)}>
    {puzzle.regions.map((region, cell) => {
      const bad = visible[cell] === 2 && cats.some(other => other !== cell && conflicts(puzzle, cell, other));
      return <View key={cell} pointerEvents="none" accessible accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={`第 ${Math.floor(cell / puzzle.size) + 1} 列第 ${cell % puzzle.size + 1} 欄，區域 ${region + 1}，${visible[cell] === 2 ? '貓咪' : visible[cell] === 1 ? '已排除' : '空白'}`}
        accessibilityHint="可使用動作選單切換記號或貓咪"
        accessibilityActions={[{ name: 'mark', label: '切換記號' }, { name: 'cat', label: '切換貓咪' }]}
        onAccessibilityAction={event => {
          if (disabled) return;
          const next = marks.map((mark, i): Mark => i !== cell ? mark : event.nativeEvent.actionName === 'cat' ? mark === 2 ? 0 : 2 : mark === 1 ? 0 : mark === 2 ? 2 : 1);
          onStroke(next);
        }}
        style={[styles.cell, { width: `${100 / puzzle.size}%`, backgroundColor: bad ? '#ef8b87' : colors[region],
          borderRightWidth: cell % puzzle.size === puzzle.size - 1 || puzzle.regions[cell + 1] !== region ? 3 : .5,
          borderBottomWidth: cell >= puzzle.size * (puzzle.size - 1) || puzzle.regions[cell + puzzle.size] !== region ? 3 : .5 }]}>
        <Text style={{ fontSize: puzzle.size === 7 ? 23 : 29, color: '#485448', userSelect: 'none' }}>{visible[cell] === 2 ? '🐱' : visible[cell] === 1 ? '×' : ''}</Text>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: BORDER, borderColor: '#4d5749', borderRadius: 12, overflow: 'hidden', ...(Platform.OS === 'web' ? { touchAction: 'none' } as ViewStyle : {}) },
  cell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#58604e' },
});
