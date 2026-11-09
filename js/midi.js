import { WebMidi } from "./vendor/webmidi.esm.min.js";
import { KEY_LAYOUT } from "./kits.js";

const KEYS = KEY_LAYOUT.map((k) => k.key);
const boundInputs = new WeakSet();

/**
 * Map a MIDI note number onto the 36-key layout.
 * MIDI 36 (C1 in most DAWs) lands on Q; the map wraps every 3 octaves.
 */
export function noteToKey(note) {
  const n = note | 0;
  if (n < 0 || n > 127) return null;
  return KEYS[n % KEYS.length];
}

function listen(input, onNote) {
  if (boundInputs.has(input)) return;
  boundInputs.add(input);
  input.addListener("noteon", (e) => {
    if (!e.velocity) return;
    const key = noteToKey(e.note.number);
    if (!key) return;
    onNote(key, {
      note: e.note.number,
      velocity: e.velocity,
    });
  });
}

function report(onDevices) {
  onDevices?.({
    supported: WebMidi.supported,
    enabled: WebMidi.enabled,
    inputs: WebMidi.inputs.map((input) => input.name).filter(Boolean),
  });
}

/**
 * Enable WEBMIDI.js and forward note-ons from every input (including hotplug).
 * Resolves even when MIDI is missing or denied so keyboard/touch still work.
 */
export async function enableMidi({ onNote, onDevices } = {}) {
  if (!WebMidi.supported) {
    onDevices?.({ supported: false, enabled: false, inputs: [] });
    return null;
  }

  try {
    await WebMidi.enable({ sysex: false });
  } catch {
    onDevices?.({ supported: true, enabled: false, inputs: [] });
    return null;
  }

  const bind = () => {
    WebMidi.inputs.forEach((input) => listen(input, onNote));
    report(onDevices);
  };

  WebMidi.addListener("connected", (e) => {
    if (e.port?.type === "input") bind();
  });
  WebMidi.addListener("disconnected", () => report(onDevices));
  bind();
  return WebMidi;
}
