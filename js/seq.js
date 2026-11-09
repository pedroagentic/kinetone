import { pick } from "./util.js";
import { KEY_LAYOUT } from "./kits.js";

const DRUMS = ["q", "w", "e", "r", "t", "y", "o"];
const BASS = ["a", "s", "d", "7"];
const MELODY = ["f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "1", "2", "3", "4"];
const SPICE = ["u", "i", "p", "b", "n", "m", "5", "6", "8", "9", "0"];

export class Sequencer {
  constructor(trigger) {
    this.trigger = trigger;
    this.jam = false;
    this.recording = false;
    this.playingLoop = false;
    this.takes = [];
    this.loop = [];
    this.recStart = 0;
    this.playStart = 0;
    this.loopLen = 0;
    this.cursor = 0;
    this.nextJam = 0;
    this.beat = 0;
    this.bpm = 108;
  }

  toggleJam() {
    this.jam = !this.jam;
    if (this.jam) {
      this.playingLoop = false;
      this.nextJam = performance.now();
      this.beat = 0;
    }
    return this.jam;
  }

  toggleRecord() {
    if (this.recording) {
      this.recording = false;
      if (this.takes.length > 1) {
        this.loop = this.takes.slice();
        this.loopLen = Math.max(1000, performance.now() - this.recStart);
        this.playingLoop = true;
        this.playStart = performance.now();
        this.cursor = 0;
      }
      this.takes = [];
      return "stop";
    }
    this.recording = true;
    this.playingLoop = false;
    this.jam = false;
    this.takes = [];
    this.recStart = performance.now();
    return "rec";
  }

  stop() {
    this.jam = false;
    this.recording = false;
    this.playingLoop = false;
    this.takes = [];
    this.loop = [];
  }

  capture(key) {
    if (!this.recording) return;
    this.takes.push({ t: performance.now() - this.recStart, key });
  }

  update(now) {
    if (this.playingLoop && this.loop.length) {
      const t = (now - this.playStart) % this.loopLen;
      const prev = (now - this.playStart - 16) % this.loopLen;
      for (const ev of this.loop) {
        if (prev < t) {
          if (ev.t > prev && ev.t <= t) this.trigger(ev.key, { fromSeq: true });
        } else if (ev.t > prev || ev.t <= t) {
          this.trigger(ev.key, { fromSeq: true });
        }
      }
    }

    if (!this.jam) return;
    if (now < this.nextJam) return;
    const step = 60000 / this.bpm / 2;
    this.nextJam = now + step;
    this.beat += 1;

    if (this.beat % 2 === 0) this.trigger("q", { fromSeq: true });
    if (this.beat % 4 === 2) this.trigger(pick(["w", "r"]), { fromSeq: true });
    if (this.beat % 2 === 1) this.trigger(pick(["e", "o", "y"]), { fromSeq: true });
    if (this.beat % 8 === 4) this.trigger(pick(BASS), { fromSeq: true });
    if (this.beat % 4 === 0 && Math.random() < 0.75) this.trigger(pick(MELODY), { fromSeq: true });
    if (this.beat % 8 === 6 && Math.random() < 0.5) this.trigger(pick(SPICE), { fromSeq: true });
    if (Math.random() < 0.12) this.trigger(pick(KEY_LAYOUT).key, { fromSeq: true });
  }
}
