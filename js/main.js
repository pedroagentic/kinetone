import { AudioEngine } from "./audio.js";
import { VisualEngine } from "./engine.js";
import { Sequencer } from "./seq.js";
import { TOUCH_ROWS } from "./kits.js";
import {
  DEFAULT_LOCK_MS,
  generateSession,
  remainingMs,
  resolveLockedSession,
  writeLock,
} from "./generate.js";

const params = new URLSearchParams(location.search);
const seasonParam = (params.get("season") || "").toLowerCase();
const seasonId = ["spring", "summer", "autumn", "winter"].includes(seasonParam)
  ? seasonParam
  : undefined;
const LOCK_MS = Math.max(1000, Number(params.get("lockMs")) || DEFAULT_LOCK_MS);

let { session, lock } = resolveLockedSession({
  seed: params.get("seed") || undefined,
  seasonId,
  lockMs: LOCK_MS,
});
let KITS = session.kits;
let KEY_MAP = session.keyMap;

const canvas = document.getElementById("stage");
const hint = document.getElementById("hint");
const kitBadge = document.getElementById("kit-badge");
const statusEl = document.getElementById("status");
const setTimer = document.getElementById("set-timer");
const help = document.getElementById("help");
const helpBtn = document.getElementById("help-btn");
const touchLayer = document.getElementById("touch");

const audio = new AudioEngine();
const vis = new VisualEngine(canvas, KITS[0].bg);
const seq = new Sequencer((key, meta) => trigger(key, meta));

let kitIndex = 0;
let armed = false;
let lastInput = performance.now();
let hintTimer = 0;
let kitTimer = 0;
let pointerId = null;
let lastPointerKey = null;
let lastPointerAt = 0;
let rotating = false;

function applyKit(index, { silent = false, wipe = true } = {}) {
  kitIndex = (index + KITS.length) % KITS.length;
  const kit = KITS[kitIndex];
  audio.setKit(kit);
  vis.setKit(kit, wipe && !silent);
  if (!silent) audio.play("wipe");
  kitBadge.querySelector(".kit-name").textContent = kit.name;
  kitBadge.querySelector(".kit-hint").textContent = kit.hint;
  kitBadge.dataset.dark = kit.isDark ? "1" : "0";
  if (!silent) {
    kitBadge.classList.add("show");
    clearTimeout(kitTimer);
    kitTimer = setTimeout(() => kitBadge.classList.remove("show"), 1600);
  }
  document.documentElement.style.setProperty("--fg", kit.fg);
  document.documentElement.style.setProperty("--bg", kit.bg);
  document.body.dataset.theme = kit.isDark ? "dark" : "light";
}

function arm() {
  if (!armed) {
    document.body.classList.add("live");
    armed = true;
  }
  try {
    audio.init();
    audio.setKit(KITS[kitIndex]);
    audio.resume().catch(() => {});
  } catch {
    /* Audio can stay locked until a real user gesture. Visuals still run. */
  }
}

function trigger(key, meta = {}) {
  const mapping = KEY_MAP[key];
  if (!mapping) return;
  audio.play(mapping.voice);
  vis.spawn(mapping.effect, meta.x != null ? { x: meta.x, y: meta.y } : {});
  if (!meta.fromSeq) seq.capture(key);
  pingTouch(key);
  hideHintSoon();
}

function nextKit(dir = 1) {
  applyKit(kitIndex + dir);
  hideHintSoon();
}

function formatLock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateSeasonCopy() {
  document.body.dataset.season = session.season.id;
  const seasonTag = document.getElementById("season-tag");
  if (seasonTag) {
    seasonTag.textContent = `${session.season.name} ${session.season.year} · a new set every five minutes`;
  }
  const seasonNote = document.getElementById("season-note");
  if (seasonNote) {
    seasonNote.textContent = `This set is ${session.season.name.toLowerCase()} in the ${session.season.hemisphere}ern hemisphere (seed ${session.seed}). Palettes, scales, and visuals stay locked for five minutes, then a new set is rolled. Reloading during the window keeps the same set.`;
  }
}

function updateTimer() {
  if (!setTimer) return;
  setTimer.textContent = formatLock(remainingMs(lock, LOCK_MS));
}

function publish() {
  window.Kinetone = { trigger, nextKit, arm, seq, audio, vis, KITS, session, KEY_MAP, lock, LOCK_MS };
}

function applySession(next, { announce = false } = {}) {
  session = next;
  KITS = next.kits;
  KEY_MAP = next.keyMap;
  updateSeasonCopy();
  applyKit(0, { silent: !announce, wipe: announce });
  if (announce) {
    for (const name of session.intro) vis.spawn(name);
  }
  publish();
}

function rotateSet() {
  if (rotating) return;
  rotating = true;
  const next = generateSession({ seasonId });
  lock = {
    seed: next.seed,
    startedAt: Date.now(),
    generatedAt: Date.now(),
    seasonId: next.season.id,
  };
  writeLock(lock);
  applySession(next, { announce: true });
  rotating = false;
}

function tickLock() {
  const left = remainingMs(lock, LOCK_MS);
  updateTimer();
  if (left <= 0) rotateSet();
}

function hideHintSoon() {
  lastInput = performance.now();
  hint.classList.add("gone");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    if (performance.now() - lastInput > 18000) hint.classList.remove("gone");
  }, 20000);
}

function setStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.toggle("on", Boolean(text));
}

function toggleHelp() {
  const open = help.classList.toggle("open");
  helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function pingTouch(key) {
  const cell = touchLayer.querySelector(`[data-key="${key}"]`);
  if (!cell) return;
  cell.classList.remove("hit");
  void cell.offsetWidth;
  cell.classList.add("hit");
}

function buildTouchGrid() {
  touchLayer.innerHTML = "";
  TOUCH_ROWS.forEach((row) => {
    const r = document.createElement("div");
    r.className = "row";
    r.style.setProperty("--n", row.length);
    row.forEach((key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.key = key;
      b.textContent = key;
      b.setAttribute("aria-label", `Play ${key}`);
      r.appendChild(b);
    });
    touchLayer.appendChild(r);
  });
}

function keyFromPoint(x, y) {
  const rows = TOUCH_ROWS;
  const row = Math.max(0, Math.min(rows.length - 1, Math.floor((y / window.innerHeight) * rows.length)));
  const cols = rows[row];
  const col = Math.max(0, Math.min(cols.length - 1, Math.floor((x / window.innerWidth) * cols.length)));
  return cols[col];
}

function isTypingHotkey(e) {
  return e.metaKey || e.ctrlKey || e.altKey;
}

window.addEventListener("keydown", (e) => {
  if (isTypingHotkey(e)) return;
  const key = e.key.toLowerCase();

  if (key === "?" || (e.shiftKey && key === "/")) {
    e.preventDefault();
    toggleHelp();
    return;
  }
  if (key === "escape") {
    e.preventDefault();
    help.classList.remove("open");
    seq.stop();
    setStatus("");
    return;
  }
  if (key === "enter") {
    e.preventDefault();
    arm();
    const on = seq.toggleJam();
    setStatus(on ? "auto-jam" : "");
    return;
  }
  if (key === "`") {
    e.preventDefault();
    arm();
    const state = seq.toggleRecord();
    setStatus(state === "rec" ? "rec" : seq.playingLoop ? "loop" : "");
    return;
  }
  if (key === "f" && e.shiftKey) {
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    arm();
    nextKit(e.shiftKey ? -1 : 1);
    return;
  }

  if (KEY_MAP[key]) {
    e.preventDefault();
    arm();
    trigger(key);
  }
});

function triggerPointer(key, x, y) {
  const now = performance.now();
  if (key === lastPointerKey && now - lastPointerAt < 90) return;
  lastPointerKey = key;
  lastPointerAt = now;
  trigger(key, { x, y });
}

window.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#help") || e.target.closest("#help-btn") || e.target.closest("a")) return;
  arm();
  pointerId = e.pointerId;
  const key = e.target.dataset?.key || keyFromPoint(e.clientX, e.clientY);
  triggerPointer(key, e.clientX, e.clientY);
});

window.addEventListener("pointermove", (e) => {
  if (pointerId == null || e.pointerId !== pointerId) return;
  if (e.pointerType === "mouse" && e.buttons === 0) return;
  const key = keyFromPoint(e.clientX, e.clientY);
  triggerPointer(key, e.clientX, e.clientY);
});

window.addEventListener("pointerup", (e) => {
  if (e.pointerId === pointerId) pointerId = null;
});

helpBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleHelp();
});

help.addEventListener("click", (e) => {
  if (e.target === help) toggleHelp();
});

buildTouchGrid();
if (navigator.maxTouchPoints > 0) document.body.classList.add("touch");
updateSeasonCopy();
applyKit(0, { silent: true, wipe: false });
updateTimer();
setInterval(tickLock, 250);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tickLock();
});
publish();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  vis.update(dt);
  vis.draw();
  seq.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("load", () => {
  document.body.classList.add("ready");
  setTimeout(() => {
    for (const name of session.intro) vis.spawn(name);
  }, 400);
});
