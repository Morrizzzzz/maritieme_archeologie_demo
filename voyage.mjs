// Decorative route, deliberately separate from heritage records and exports.
export const VOYAGE_CENTER = [3.4, 53.35];
export const VOYAGE_SECONDS = 150;
export function voyagePosition(seconds) {
  const angle = ((seconds % VOYAGE_SECONDS) / VOYAGE_SECONDS) * Math.PI * 2;
  const lng = VOYAGE_CENTER[0] + .55 * Math.cos(angle);
  const lat = VOYAGE_CENTER[1] + .24 * Math.sin(angle);
  const east = -.55 * Math.sin(angle) * Math.cos(lat * Math.PI / 180);
  const north = .24 * Math.cos(angle);
  return {lng, lat, heading: Math.atan2(east, north)};
}
export class TripleClick {
  constructor(windowMs = 30000) { this.windowMs = windowMs; this.count = 0; this.last = null; }
  click(now) {
    if (this.last === null || now - this.last > this.windowMs) this.count = 0;
    this.last = now;
    this.count++;
    if (this.count === 3) { this.count = 0; this.last = null; return true; }
    return false;
  }
}
export class VoyageClock {
  constructor(paused = false) { this.seconds = 0; this.paused = paused; this.suspended = false; this.last = null; }
  tick(now) {
    if (this.last !== null && !this.paused && !this.suspended) this.seconds += Math.max(0, Math.min(now - this.last, 100)) / 1000;
    this.last = now;
    return this.seconds;
  }
  setPaused(value) { this.paused = value; this.last = null; }
  setSuspended(value) { this.suspended = value; this.last = null; }
}
