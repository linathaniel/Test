import type { Point } from '../content/model';

/** The authored 5 × 5 floor is shared by rendering, hit testing and E selection. */
export function puzzleCell(index: number): Point {
  return { x: 314 + index % 5 * 74, y: 181 + Math.floor(index / 5) * 54 };
}
