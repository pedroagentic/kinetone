import {
  clamp,
  hashString,
  hslToHex,
  luminance,
  mulberry32,
  pickRng,
  rangeRng,
  shuffle,
  wrapHue,
} from "./util.js";
import { EFFECT_NAMES } from "./effects.js";
import { KEY_LAYOUT } from "./kits.js";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

const SCALES = {
  "major pent": { intervals: [0, 2, 4, 7, 9] },
  "minor pent": { intervals: [0, 3, 5, 7, 10] },
  dorian: { intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { intervals: [0, 2, 4, 5, 7, 9, 10] },
  lydian: { intervals: [0, 2, 4, 6, 7, 9, 11] },
  aeolian: { intervals: [0, 2, 3, 5, 7, 8, 10] },
  phrygian: { intervals: [0, 1, 3, 5, 7, 8, 10] },
  "harmonic minor": { intervals: [0, 2, 3, 5, 7, 8, 11] },
  major: { intervals: [0, 2, 4, 5, 7, 9, 11] },
};

const SEASON_MUSIC = {
  spring: {
    scales: ["major pent", "lydian", "major", "dorian", "mixolydian"],
    timbres: ["warm", "organic", "crystal", "digital", "lush"],
    darkCount: 3,
    roots: [55, 57, 60, 62, 64],
  },
  summer: {
    scales: ["mixolydian", "major", "major pent", "phrygian", "lydian"],
    timbres: ["acid", "digital", "warm", "harsh", "crystal"],
    darkCount: 4,
    roots: [52, 55, 57, 60, 64],
  },
  autumn: {
    scales: ["minor pent", "dorian", "aeolian", "mixolydian", "harmonic minor"],
    timbres: ["warm", "organic", "lush", "lofi", "harsh"],
    darkCount: 5,
    roots: [50, 53, 55, 57, 58],
  },
  winter: {
    scales: ["aeolian", "harmonic minor", "lydian", "major pent", "phrygian"],
    timbres: ["crystal", "digital", "lush", "lofi", "warm"],
    darkCount: 4,
    roots: [52, 54, 57, 59, 61],
  },
};

const ALL_TIMBRES = ["digital", "warm", "acid", "organic", "crystal", "harsh", "lush", "lofi"];

const NAMES = {
  spring: {
    adj: ["Blossom", "Pollen", "Thaw", "Lilac", "Sprout", "Rain", "Moss", "Cherry", "Dew", "Lark", "Petal", "Willow"],
    noun: ["Grove", "Veil", "Choir", "Field", "Glass", "Pulse", "Bloom", "Creek", "Haze", "Well", "Glade"],
  },
  summer: {
    adj: ["Coral", "Noon", "Tropic", "Citrus", "Sol", "Harbor", "Reef", "Melon", "Heat", "Lagoon", "Mango", "Solstice"],
    noun: ["Pulse", "Glass", "Market", "Drift", "Flare", "Tide", "Canopy", "Spark", "Bloom", "Choir", "Glare"],
  },
  autumn: {
    adj: ["Maple", "Russet", "Harvest", "Cinder", "Amber", "Copper", "Ochre", "Hearth", "Maroon", "Gilt", "Thicket", "Cider", "Umber", "Acorn", "Fox", "Bramble"],
    noun: ["Dusk", "Veil", "Grove", "Loom", "Choir", "Drift", "Field", "Glass", "Pulse", "Well", "Orchard", "Husk", "Lantern", "Ridge", "Ember"],
  },
  winter: {
    adj: ["Frost", "Silver", "Pine", "Coal", "Aurora", "Porcelain", "Gale", "Quartz", "Hollow", "Nimbus", "Ivory", "Slate"],
    noun: ["Glass", "Veil", "Choir", "Well", "Drift", "Night", "Flake", "Hush", "Ridge", "Pulse", "Mirror", "Thorn"],
  },
};

const SOUTH_TZ =
  /Australia\/|Pacific\/Auckland|Pacific\/Fiji|Pacific\/Chatham|Pacific\/Tongatapu|Pacific\/Port_Moresby|Pacific\/Guadalcanal|Pacific\/Noumea|Indian\/Mauritius|Africa\/Johannesburg|Africa\/Harare|Africa\/Windhoek|Africa\/Maputo|Africa\/Lusaka|America\/Sao_Paulo|America\/Argentina|America\/Santiago|America\/Montevideo|America\/Asuncion|America\/Fortaleza|America\/Recife|America\/Bahia|America\/Belem|America\/Cayenne|Antarctica\//;

export function detectHemisphere(timeZone) {
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return SOUTH_TZ.test(tz) ? "south" : "north";
}

export function detectSeason(date = new Date(), hemisphere = detectHemisphere()) {
  const month = date.getMonth();
  let id;
  let start;
  let end;
  if (month === 11 || month <= 1) {
    id = "winter";
    start = month === 11 ? new Date(date.getFullYear(), 11, 1) : new Date(date.getFullYear() - 1, 11, 1);
    end = new Date(start.getFullYear() + 1, 2, 1);
  } else if (month <= 4) {
    id = "spring";
    start = new Date(date.getFullYear(), 2, 1);
    end = new Date(date.getFullYear(), 5, 1);
  } else if (month <= 7) {
    id = "summer";
    start = new Date(date.getFullYear(), 5, 1);
    end = new Date(date.getFullYear(), 8, 1);
  } else {
    id = "autumn";
    start = new Date(date.getFullYear(), 8, 1);
    end = new Date(date.getFullYear(), 11, 1);
  }

  if (hemisphere === "south") {
    id = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" }[id];
  }

  const progress = clamp((date - start) / Math.max(1, end - start), 0, 1);
  const names = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
  return {
    id,
    name: names[id],
    hemisphere,
    progress,
    year: date.getFullYear(),
    month: month + 1,
  };
}

function hueBetween(rng, a, b) {
  a = wrapHue(a);
  b = wrapHue(b);
  if (Math.abs(b - a) <= 180) return wrapHue(a + rng() * (b - a));
  const span = 360 - Math.abs(b - a);
  const dir = b > a ? -1 : 1;
  return wrapHue(a + dir * rng() * span);
}

function color(rng, h0, h1, s0, s1, l0, l1) {
  return hslToHex(hueBetween(rng, h0, h1), rangeRng(rng, s0, s1), rangeRng(rng, l0, l1));
}

function ensurePop(hex, isDark) {
  const lum = luminance(hex);
  if (isDark && lum < 0.16) {
    return hslToHex(hexToHue(hex), 0.72, 0.62);
  }
  if (!isDark && lum > 0.62) {
    return hslToHex(hexToHue(hex), 0.62, 0.38);
  }
  return hex;
}

function hexToHue(hex) {
  const [r0, g0, b0] = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r0) h = ((g0 - b0) / d) % 6;
  else if (max === g0) h = (b0 - r0) / d + 2;
  else h = (r0 - g0) / d + 4;
  return wrapHue(h * 60);
}

function paletteFor(seasonId, progress, isDark, rng) {
  const t = progress;
  if (seasonId === "autumn") return autumnPalette(t, isDark, rng);
  if (seasonId === "winter") return winterPalette(t, isDark, rng);
  if (seasonId === "spring") return springPalette(t, isDark, rng);
  return summerPalette(t, isDark, rng);
}

function autumnPalette(t, isDark, rng) {
  const rust = [lerp(28, 10, t), lerp(18, 6, t)];
  const gold = [lerp(48, 36, t), lerp(40, 32, t)];
  const wine = [lerp(8, 350, t), lerp(355, 340, t)];
  const olive = [lerp(90, 48, t), lerp(70, 38, t)];
  const sat = lerp(0.72, 0.55, t);
  if (isDark) {
    const bg = color(rng, lerp(22, 8, t), lerp(32, 18, t), lerp(0.42, 0.28, t), lerp(0.55, 0.38, t), 0.055, 0.11);
    const fg = color(rng, 32, 48, 0.18, 0.35, 0.9, 0.96);
    const dim = color(rng, 18, 32, 0.22, 0.4, 0.14, 0.2);
    const colors = [
      color(rng, rust[0], rust[1], sat, sat + 0.18, 0.5, 0.64),
      color(rng, gold[0], gold[1], sat - 0.05, sat + 0.15, 0.55, 0.7),
      color(rng, wine[0], wine[1], sat, sat + 0.2, 0.42, 0.58),
      color(rng, olive[0], olive[1], 0.35, 0.55, 0.38, 0.52),
      color(rng, 32, 48, 0.25, 0.45, 0.78, 0.9),
    ].map((c) => ensurePop(c, true));
    return { bg, fg, dim, colors };
  }
  const bg = color(rng, 28, 42, 0.22, 0.4, lerp(0.88, 0.84, t), lerp(0.94, 0.9, t));
  const fg = color(rng, 18, 28, 0.35, 0.55, 0.1, 0.16);
  const dim = color(rng, 28, 40, 0.18, 0.32, 0.78, 0.86);
  const colors = [
    color(rng, rust[0], rust[1], 0.62, 0.82, 0.36, 0.48),
    color(rng, gold[0], gold[1], 0.55, 0.75, 0.4, 0.52),
    color(rng, wine[0], wine[1], 0.5, 0.7, 0.32, 0.44),
    color(rng, olive[0], olive[1], 0.35, 0.55, 0.28, 0.4),
    color(rng, 200, 220, 0.25, 0.4, 0.28, 0.4),
  ].map((c) => ensurePop(c, false));
  return { bg, fg, dim, colors };
}

function winterPalette(t, isDark, rng) {
  if (isDark) {
    const bg = color(rng, lerp(220, 230, t), lerp(245, 250, t), 0.18, 0.4, 0.05, 0.1);
    const fg = color(rng, 200, 220, 0.08, 0.2, 0.92, 0.97);
    const dim = color(rng, 210, 230, 0.12, 0.28, 0.14, 0.2);
    const colors = [
      color(rng, 190, 210, 0.45, 0.7, 0.58, 0.78),
      color(rng, 0, 10, 0.02, 0.08, 0.88, 0.98),
      color(rng, 250, 280, 0.35, 0.6, 0.55, 0.72),
      color(rng, 150, 175, lerp(0.2, 0.45, t), 0.55, 0.42, 0.58),
      color(rng, 350, 10, 0.45, 0.7, 0.5, 0.62),
    ].map((c) => ensurePop(c, true));
    return { bg, fg, dim, colors };
  }
  const bg = color(rng, 200, 215, 0.16, 0.32, 0.9, 0.96);
  const fg = color(rng, 210, 230, 0.28, 0.48, 0.12, 0.2);
  const dim = color(rng, 200, 215, 0.12, 0.24, 0.82, 0.9);
  const colors = [
    color(rng, 190, 210, 0.55, 0.8, 0.36, 0.48),
    color(rng, 220, 240, 0.3, 0.5, 0.3, 0.42),
    color(rng, 155, 175, 0.35, 0.55, 0.32, 0.44),
    color(rng, 345, 358, 0.5, 0.72, 0.38, 0.5),
    color(rng, 200, 210, 0.05, 0.15, 0.28, 0.4),
  ].map((c) => ensurePop(c, false));
  return { bg, fg, dim, colors };
}

function springPalette(t, isDark, rng) {
  if (isDark) {
    const bg = color(rng, lerp(130, 145, t), lerp(155, 170, t), 0.18, 0.35, 0.07, 0.12);
    const fg = color(rng, 80, 110, 0.12, 0.28, 0.9, 0.96);
    const dim = color(rng, 130, 150, 0.15, 0.3, 0.16, 0.22);
    const colors = [
      color(rng, 330, 350, 0.45, 0.7, 0.62, 0.76),
      color(rng, lerp(90, 115, t), lerp(110, 135, t), 0.45, 0.7, 0.5, 0.64),
      color(rng, 270, 295, 0.35, 0.55, 0.6, 0.74),
      color(rng, 48, 58, 0.5, 0.75, 0.58, 0.7),
      color(rng, 190, 210, 0.3, 0.5, 0.62, 0.78),
    ].map((c) => ensurePop(c, true));
    return { bg, fg, dim, colors };
  }
  const bg = color(rng, 70, 95, 0.18, 0.35, 0.9, 0.96);
  const fg = color(rng, 130, 150, 0.3, 0.5, 0.12, 0.18);
  const dim = color(rng, 80, 100, 0.12, 0.25, 0.82, 0.9);
  const colors = [
    color(rng, 330, 350, 0.45, 0.7, 0.42, 0.55),
    color(rng, lerp(100, 125, t), lerp(120, 140, t), 0.45, 0.7, 0.34, 0.46),
    color(rng, 265, 290, 0.35, 0.55, 0.4, 0.52),
    color(rng, 48, 58, 0.5, 0.75, 0.42, 0.54),
    color(rng, 200, 220, 0.3, 0.5, 0.4, 0.52),
  ].map((c) => ensurePop(c, false));
  return { bg, fg, dim, colors };
}

function summerPalette(t, isDark, rng) {
  if (isDark) {
    const bg = color(rng, lerp(210, 250, t), lerp(230, 280, t), 0.2, 0.45, 0.05, 0.1);
    const fg = color(rng, 40, 55, 0.08, 0.2, 0.92, 0.97);
    const dim = color(rng, 220, 260, 0.15, 0.3, 0.14, 0.2);
    const colors = [
      color(rng, 8, 22, 0.7, 0.9, 0.55, 0.66),
      color(rng, 175, 195, 0.65, 0.9, 0.5, 0.62),
      color(rng, 48, 58, 0.75, 0.95, 0.55, 0.66),
      color(rng, 320, 340, 0.65, 0.9, 0.55, 0.68),
      color(rng, 95, 120, 0.6, 0.85, 0.5, 0.62),
    ].map((c) => ensurePop(c, true));
    return { bg, fg, dim, colors };
  }
  const bg = color(rng, 40, 55, 0.35, 0.55, 0.88, 0.94);
  const fg = color(rng, 200, 220, 0.35, 0.55, 0.12, 0.2);
  const dim = color(rng, 40, 50, 0.25, 0.4, 0.8, 0.88);
  const colors = [
    color(rng, 6, 18, 0.7, 0.9, 0.42, 0.54),
    color(rng, 175, 195, 0.55, 0.8, 0.36, 0.48),
    color(rng, 42, 52, 0.7, 0.9, 0.42, 0.54),
    color(rng, 200, 220, 0.45, 0.7, 0.32, 0.44),
    color(rng, 330, 350, 0.5, 0.75, 0.4, 0.52),
  ].map((c) => ensurePop(c, false));
  return { bg, fg, dim, colors };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function nameList(rng, seasonId) {
  const adj = shuffle(NAMES[seasonId].adj, rng);
  const noun = shuffle(NAMES[seasonId].noun, rng);
  return adj.map((a, i) => `${a} ${noun[i % noun.length]}`);
}

function buildScale(root, intervals) {
  const notes = [];
  for (let oct = 0; oct < 3 && notes.length < 11; oct++) {
    for (const step of intervals) notes.push(root + oct * 12 + step);
  }
  return notes.slice(0, 11);
}

function assignTimbres(seasonId, rng) {
  const preferred = SEASON_MUSIC[seasonId].timbres;
  const rest = ALL_TIMBRES.filter((t) => !preferred.includes(t));
  return [...shuffle(preferred, rng), ...shuffle(rest, rng)].slice(0, 8);
}

function shuffleLayout(rng) {
  const playable = EFFECT_NAMES.filter((n) => n !== "paletteWipe");
  const effects = shuffle(playable, rng);
  return KEY_LAYOUT.map((slot, i) => ({
    key: slot.key,
    voice: slot.voice,
    effect: effects[i % effects.length],
  }));
}

function makeSeed() {
  const bytes = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else {
    bytes[0] = (Math.random() * 0xffffffff) | 0;
    bytes[1] = Date.now() >>> 0;
  }
  return (bytes[0] >>> 0).toString(36) + (bytes[1] >>> 0).toString(36);
}

const INTRO = ["burst", "ring", "star", "moon", "bloom", "spiral", "prism", "hex", "corona"];

export function generateSession({ seed, date = new Date(), seasonId, hemisphere } = {}) {
  const resolvedSeed = seed || makeSeed();
  const rng = mulberry32(hashString(String(resolvedSeed)));
  const hemi = hemisphere || detectHemisphere();
  const season = detectSeason(date, hemi);
  if (seasonId && SEASON_MUSIC[seasonId]) {
    if (season.id !== seasonId) season.progress = 0.42;
    season.id = seasonId;
    season.name = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" }[seasonId];
  }

  const music = SEASON_MUSIC[season.id];
  const timbres = assignTimbres(season.id, rng);
  const darkFlags = shuffle(
    Array.from({ length: 8 }, (_, i) => i < music.darkCount),
    rng
  );
  const names = nameList(rng, season.id);
  const layout = shuffleLayout(rng);
  const keyMap = Object.fromEntries(layout.map((k) => [k.key, k]));

  const kits = timbres.map((timbre, i) => {
    const isDark = darkFlags[i];
    const pal = paletteFor(season.id, season.progress, isDark, rng);
    const scaleName = pickRng(music.scales, rng);
    const root = pickRng(music.roots, rng);
    const scale = buildScale(root, SCALES[scaleName].intervals);
    const name = names[i];
    const rootName = NOTE_NAMES[((root % 12) + 12) % 12];
    return {
      id: `${season.id}-${i}`,
      name,
      hint: `${season.name} · ${rootName} ${scaleName}`,
      ...pal,
      isDark,
      timbre,
      scale,
      kickPitch: 0.82 + rng() * 0.36,
      decay: 0.72 + rng() * 0.7,
      brightness: 0.72 + rng() * 0.6,
      filter: 1100 + rng() * 3000,
      delay: 0.09 + rng() * 0.2,
      season: season.id,
    };
  });

  return {
    seed: resolvedSeed,
    season,
    kits,
    layout,
    keyMap,
    intro: shuffle(INTRO, rng).slice(0, 3),
  };
}

export const LOCK_STORAGE_KEY = "kinetone.set-lock";
export const DEFAULT_LOCK_MS = 5 * 60 * 1000;

export function readLock() {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const lock = JSON.parse(raw);
    if (!lock?.seed || typeof lock.startedAt !== "number") return null;
    return lock;
  } catch {
    return null;
  }
}

export function writeLock(lock) {
  try {
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(lock));
  } catch {
    /* private mode */
  }
}

export function remainingMs(lock, lockMs, now = Date.now()) {
  if (!lock) return 0;
  return Math.max(0, lock.startedAt + lockMs - now);
}

export function resolveLockedSession({ seed, seasonId, lockMs = DEFAULT_LOCK_MS, now = Date.now() } = {}) {
  const existing = readLock();
  const leftover = remainingMs(existing, lockMs, now);
  const seedMatches = seed && existing?.seed === seed;
  const seasonMatches = !seasonId || existing?.seasonId === seasonId;
  const canReuse = leftover > 0 && seasonMatches && (!seed || seedMatches);

  if (canReuse) {
    const session = generateSession({
      seed: existing.seed,
      date: existing.generatedAt ? new Date(existing.generatedAt) : new Date(existing.startedAt),
      seasonId: existing.seasonId,
    });
    return { session, lock: existing, reused: true };
  }

  const session = generateSession({ seed, seasonId });
  const lock = {
    seed: session.seed,
    startedAt: now,
    generatedAt: now,
    seasonId: session.season.id,
  };
  writeLock(lock);
  return { session, lock, reused: false };
}
