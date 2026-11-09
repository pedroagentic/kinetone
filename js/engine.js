import { mixHex, clamp } from "./util.js";
import { createEffect } from "./effects.js";

export class VisualEngine {
  constructor(canvas, initialBg = "#0b1020") {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.fx = [];
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.kit = null;
    this.bg = initialBg;
    this.bgFrom = initialBg;
    this.bgTo = initialBg;
    this.bgT = 1;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setKit(kit, wipe = true) {
    this.kit = kit;
    this.bgFrom = this.bgTo;
    this.bgTo = kit.bg;
    this.bgT = 0;
    if (wipe) {
      this.spawn("paletteWipe", { x: this.w / 2, y: this.h / 2 });
    }
  }

  env(extra = {}) {
    const kit = this.kit;
    return {
      w: this.w,
      h: this.h,
      colors: kit.colors,
      fg: kit.fg,
      bg: kit.bg,
      dim: kit.dim,
      isDark: kit.isDark,
      ...extra,
    };
  }

  spawn(name, extra = {}) {
    if (this.fx.length > 80) this.fx.splice(0, this.fx.length - 80);
    this.fx.push(createEffect(name, this.env(extra)));
  }

  update(dt) {
    this.bgT = clamp(this.bgT + dt * 2.4, 0, 1);
    this.bg = mixHex(this.bgFrom, this.bgTo, this.bgT);
    for (const f of this.fx) f.update(dt);
    this.fx = this.fx.filter((f) => !f.dead);
  }

  draw() {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const additive = this.kit?.isDark && this.kit?.timbre === "acid";
    for (const f of this.fx) {
      ctx.save();
      if (additive && f.constructor.name !== "PaletteWipe") {
        ctx.globalCompositeOperation = "lighter";
      }
      f.draw(ctx);
      ctx.restore();
    }
  }
}
