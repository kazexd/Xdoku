import type { Mark } from './engine';

export type Point = { x: number; y: number };
export type Grid = { size: number; width: number; height: number };
export type Stroke = {
  start: Point; previous: Point; original: Mark[]; marks: Mark[];
  mode: 0 | 1 | null; dragging: boolean; visited: Set<number>;
};
export const DRAG_THRESHOLD = 8;

export function cellAt(point: Point, grid: Grid): number | null {
  if (grid.width <= 0 || grid.height <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.y < 0 || point.x >= grid.width || point.y >= grid.height) return null;
  return Math.floor(point.y / grid.height * grid.size) * grid.size + Math.floor(point.x / grid.width * grid.size);
}

export function beginStroke(marks: Mark[], point: Point, grid: Grid): Stroke | null {
  const cell = cellAt(point, grid);
  if (cell === null) return null;
  return { start: point, previous: point, original: [...marks], marks: [...marks],
    mode: marks[cell] === 2 ? null : marks[cell] === 1 ? 0 : 1, dragging: false, visited: new Set() };
}

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
