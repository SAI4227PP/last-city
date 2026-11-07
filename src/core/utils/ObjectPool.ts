export class ObjectPool<T> {
  private available: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private resetFn?: (item: T) => void;

  constructor(factory: () => T, initialSize: number = 10, resetFn?: (item: T) => void) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.factory());
    }
  }

  public acquire(): T {
    let item = this.available.pop();
    if (!item) {
      item = this.factory();
    }
    this.active.add(item);
    return item;
  }

  public release(item: T): void {
    if (this.active.delete(item)) {
      if (this.resetFn) {
        this.resetFn(item);
      }
      this.available.push(item);
    }
  }

  public releaseAll(): void {
    for (const item of this.active) {
      if (this.resetFn) {
        this.resetFn(item);
      }
      this.available.push(item);
    }
    this.active.clear();
  }

  public getActiveCount(): number {
    return this.active.size;
  }
}
