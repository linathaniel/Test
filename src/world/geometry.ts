import type { Point, Rect } from '../content/model';

export function direction(keys: ReadonlySet<string>): Point {
  const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const y = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}
export function isSafe(p: Point, obstacles: Rect[]): boolean {
  return p.x >= 63 && p.x <= 897 && p.y >= 106 && p.y <= 474 && !obstacles.some((r) => p.x > r.x - 11 && p.x < r.x + r.width + 11 && p.y > r.y && p.y < r.y + r.height + 11);
}
export function clearLine(a: Point, b: Point, obstacles: Rect[]): boolean {
  return !obstacles.some((r) => {
    let t0 = 0; let t1 = 1;
    const dx = b.x - a.x; const dy = b.y - a.y;
    for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.width - a.x], [-dy, a.y - r.y], [dy, r.y + r.height - a.y]]) {
      if (p === 0) { if (q < 0) return false; }
      else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
        if (t0 > t1) return false;
      }
    }
    return true;
  });
}
