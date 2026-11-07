export class MathUtils {
  public static clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  public static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  public static distanceSq3D(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return dx * dx + dy * dy + dz * dz;
  }

  public static distance3D(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    return Math.sqrt(this.distanceSq3D(x1, y1, z1, x2, y2, z2));
  }

  public static randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public static randomChoice<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
}
