export class Clock {
  private start: number = performance.now();
  private last: number  = performance.now();

  // total time since start in seconds
  getElapsedTime(): number {
    return (performance.now() - this.start) / 1000;
  }

  // time since last getDelta call in seconds — for frame-based updates
  getDelta(): number {
    const now   = performance.now();
    const delta = (now - this.last) / 1000;
    this.last   = now;
    return delta;
  }

  reset() {
    this.start = performance.now();
    this.last  = performance.now();
  }
}