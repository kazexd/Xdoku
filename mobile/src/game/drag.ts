import type { Mark } from './engine';

export type Point = { x: number; y: number };
export type Grid = { size: number; width: number; height: number };
export type Stroke = {
  start: Point; previous: Point; original: Mark[]; marks: Mark[];
  mode: 0 | 1 | null; dragging: boolean; visited: Set<number>;
};
export const DRAG_THRESHOLD = 8;

/** 將棋盤內容區座標換算為格子索引；越界、非有限座標或尚未量測時回傳 null。 */
export function cellAt(point: Point, grid: Grid): number | null {
  if (grid.width <= 0 || grid.height <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.y < 0 || point.x >= grid.width || point.y >= grid.height) return null;
  return Math.floor(point.y / grid.height * grid.size) * grid.size + Math.floor(point.x / grid.width * grid.size);
}

/** 保存拖曳前的棋盤快照，以起始格固定加入／清除模式；從貓咪開始時不塗改。 */
export function beginStroke(marks: Mark[], point: Point, grid: Grid): Stroke | null {
  const cell = cellAt(point, grid);
  if (cell === null) return null;
  return { start: point, previous: point, original: [...marks], marks: [...marks],
    mode: marks[cell] === 2 ? null : marks[cell] === 1 ? 0 : 1, dragging: false, visited: new Set() };
}

/** 超過移動門檻後預覽整段路徑，補上快速移動跨過的格子；保護貓咪且不修改原筆畫狀態。 */
export function moveStroke(stroke: Stroke, point: Point, grid: Grid): Stroke {
  const dragging = stroke.dragging || Math.hypot(point.x - stroke.start.x, point.y - stroke.start.y) >= DRAG_THRESHOLD;
  if (!dragging) return stroke;
  const next = { ...stroke, marks: [...stroke.marks], visited: new Set(stroke.visited), dragging: true, previous: point };
  const from = stroke.dragging ? stroke.previous : stroke.start;
  // Interpolate sparse move events so fast strokes do not skip crossed cells.
  const distance = Math.hypot(point.x - from.x, point.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / (Math.min(grid.width, grid.height) / grid.size / 4)));
  for (let step = 0; step <= steps; step++) {
    const cell = cellAt({ x: from.x + (point.x - from.x) * step / steps, y: from.y + (point.y - from.y) * step / steps }, grid);
    if (cell === null || next.visited.has(cell)) continue;
    next.visited.add(cell);
    if (next.mode !== null && next.marks[cell] !== 2) next.marks[cell] = next.mode;
  }
  return next;
}
