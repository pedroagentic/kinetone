/**
 * Eight audiovisual kits. Each kit retunes the same 36-key instrument
 * (A–Z + 0–9) with a new palette, scale, and timbre.
 */
export const KEY_LAYOUT = [
  { key: "q", effect: "burst", voice: "kick" },
  { key: "w", effect: "confetti", voice: "snare" },
  { key: "e", effect: "sparkles", voice: "hat" },
  { key: "r", effect: "flash", voice: "clap" },
  { key: "t", effect: "piston", voice: "tom" },
  { key: "y", effect: "strike", voice: "rim" },
  { key: "u", effect: "corona", voice: "cymbal" },
  { key: "i", effect: "bubbles", voice: "perc" },
  { key: "o", effect: "dots", voice: "shaker" },
  { key: "p", effect: "veil", voice: "noise" },

  { key: "a", effect: "wipeH", voice: "bass0" },
  { key: "s", effect: "wipeV", voice: "bass1" },
  { key: "d", effect: "grid", voice: "bass2" },
  { key: "f", effect: "diamond", voice: "pluck0" },
  { key: "g", effect: "hex", voice: "pluck1" },
  { key: "h", effect: "triangle", voice: "pluck2" },
  { key: "j", effect: "star", voice: "pluck3" },
  { key: "k", effect: "moon", voice: "bell0" },
  { key: "l", effect: "ring", voice: "bell1" },

  { key: "z", effect: "spiral", voice: "lead0" },
  { key: "x", effect: "pinwheel", voice: "lead1" },
  { key: "c", effect: "zigzag", voice: "lead2" },
  { key: "v", effect: "squiggle", voice: "lead3" },
  { key: "b", effect: "prism", voice: "chord" },
  { key: "n", effect: "ufo", voice: "laser" },
  { key: "m", effect: "clay", voice: "whoosh" },

  { key: "1", effect: "kaleido", voice: "arp0" },
  { key: "2", effect: "vortex", voice: "arp1" },
  { key: "3", effect: "lightning", voice: "arp2" },
  { key: "4", effect: "chevron", voice: "arp3" },
  { key: "5", effect: "bloom", voice: "pad" },
  { key: "6", effect: "shards", voice: "glass" },
  { key: "7", effect: "bars", voice: "sub" },
  { key: "8", effect: "scanlines", voice: "reverse" },
  { key: "9", effect: "rain", voice: "drip" },
  { key: "0", effect: "timer", voice: "sting" },
];

export const KEY_MAP = Object.fromEntries(KEY_LAYOUT.map((k) => [k.key, k]));

export const TOUCH_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
];
