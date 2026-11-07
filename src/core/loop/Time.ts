export class Time {
  private static _deltaTime: number = 0;
  private static _totalTime: number = 0;
  private static _frameCount: number = 0;
  private static _fps: number = 60;
  private static lastFpsUpdate: number = 0;
  private static framesSinceUpdate: number = 0;

  public static get deltaTime(): number {
    return this._deltaTime;
  }

  public static get totalTime(): number {
    return this._totalTime;
  }

  public static get frameCount(): number {
    return this._frameCount;
  }

  public static get fps(): number {
    return this._fps;
  }

  public static update(dt: number, total: number): void {
    // Clamp delta time to avoid large jumps if tab was backgrounded
    this._deltaTime = Math.min(dt, 0.1);
    this._totalTime = total;
    this._frameCount++;

    this.framesSinceUpdate++;
    if (total - this.lastFpsUpdate >= 1.0) {
      this._fps = Math.round((this.framesSinceUpdate / (total - this.lastFpsUpdate)));
      this.framesSinceUpdate = 0;
      this.lastFpsUpdate = total;
    }
  }
}
