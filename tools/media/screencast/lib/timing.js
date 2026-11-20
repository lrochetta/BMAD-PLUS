/**
 * Pure timing helpers for the screencast renderer: seeded randomness, human typing cadence,
 * easing and the smooth scroll follower. Loaded by Node (tests, render.js) and by the page.
 */
'use strict';

(function (root) {
  /** Small seeded generator (mulberry32): same seed, same sequence, on every machine. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** FNV-1a: turns a string (scene id plus step index) into a seed. */
  function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOutCubic = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const easeInOutCubic = (k) => {
    const x = clamp(k, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };

  /**
   * Time at which each character of `text` appears, in seconds from the first keystroke.
   * Variable, human-like: short random gaps, longer after spaces and separators, rare
   * hesitations. A command longer than `maxSeconds` is typed faster as a whole, never cut.
   */
  function typingTimes(text, rng, options = {}) {
    const base = options.base || 0.058;
    const maxSeconds = options.maxSeconds || 2.8;
    const times = [];
    let t = 0;
    for (let i = 0; i < text.length; i += 1) {
      times.push(t);
      const ch = text[i];
      let gap = base * (0.55 + 0.9 * rng());
      if (ch === ' ') gap += 0.035 + 0.04 * rng();
      else if ('-/=.,"\''.includes(ch)) gap += 0.02 * rng();
      if (rng() < 0.035) gap += 0.16 + 0.14 * rng();
      t += gap;
    }
    const total = times.length ? times[times.length - 1] : 0;
    if (total > maxSeconds) {
      const k = maxSeconds / total;
      for (let i = 0; i < times.length; i += 1) times[i] *= k;
    }
    return times;
  }

  /**
   * Smooth follower for a piecewise-constant target. `events` is a time-sorted list of
   * { t, target }; the position approaches the target exponentially with time constant `tau`.
   * Closed form per segment, so the value at any t is exact and order independent.
   */
  function followScroll(events, t, tau = 0.22) {
    let position = 0;
    let target = 0;
    let clock = 0;
    for (const event of events) {
      if (event.t > t) break;
      position = target + (position - target) * Math.exp(-(event.t - clock) / tau);
      clock = event.t;
      target = event.target;
    }
    return target + (position - target) * Math.exp(-(t - clock) / tau);
  }

  /** Blend weight of a camera/callout window: ramp up, hold, ramp down (all eased). */
  function windowWeight(t, start, rampIn, hold, rampOut) {
    if (t <= start) return 0;
    const u = t - start;
    if (u < rampIn) return easeInOutCubic(u / rampIn);
    if (u < rampIn + hold) return 1;
    const d = u - rampIn - hold;
    if (d < rampOut) return 1 - easeInOutCubic(d / rampOut);
    return 0;
  }

  const api = {
    mulberry32,
    hashSeed,
    clamp,
    lerp,
    easeOutCubic,
    easeInOutCubic,
    typingTimes,
    followScroll,
    windowWeight,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).timing = api;
})(globalThis);
