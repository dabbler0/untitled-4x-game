export type Coordinate = {
  x: number;
  y: number;
}

export function plus(a: Coordinate, b: Coordinate) {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function formatPosition (pos: Coordinate) {
  return `${pos.x}:${pos.y}`;
}
export function parsePosition (f: string) {
  return { x: Number(f.split(':')[0]), y: Number(f.split(':')[1]) };
}
