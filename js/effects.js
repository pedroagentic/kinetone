import { TAU, rand, randRange, randInt, pick, lerp, clamp, rgba, ease, polyPath, starPath } from "./util.js";

class Fx {
  constructor(life) {
    this.t = 0;
    this.life = life;
    this.dead = false;
  }
  step(dt) {
    this.t += dt / this.life;
    if (this.t >= 1) {
      this.t = 1;
      this.dead = true;
    }
    return this.t;
  }
}

function ink(env) {
  return env.isDark ? env.fg : env.fg;
}

function color(env, i = 0) {
  return env.colors[i % env.colors.length];
}

function rndColor(env) {
  return pick(env.colors);
}

function origin(env, fallback = "center") {
  if (env.x != null && env.y != null) return { x: env.x, y: env.y };
  if (fallback === "random") return { x: rand() * env.w, y: rand() * env.h };
  if (fallback === "edge") {
    const side = randInt(0, 3);
    if (side === 0) return { x: rand() * env.w, y: -20 };
    if (side === 1) return { x: env.w + 20, y: rand() * env.h };
    if (side === 2) return { x: rand() * env.w, y: env.h + 20 };
    return { x: -20, y: rand() * env.h };
  }
  return { x: env.w * 0.5, y: env.h * 0.5 };
}

function glow(ctx, env, c, blur = 24) {
  if (!env.isDark) return;
  ctx.shadowColor = c;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

class Burst extends Fx {
  constructor(env) {
    super(0.7);
    this.env = env;
    this.o = origin(env, "random");
    this.c = rndColor(env);
    this.max = Math.min(env.w, env.h) * randRange(0.22, 0.42);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - ease.outQuad(this.t);
    glow(ctx, this.env, this.c, 30);
    ctx.beginPath();
    ctx.arc(this.o.x, this.o.y, this.max * p, 0, TAU);
    ctx.fillStyle = rgba(this.c, a * 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.o.x, this.o.y, this.max * p * 0.55, 0, TAU);
    ctx.fillStyle = rgba(this.env.fg, a * 0.35);
    ctx.fill();
    noGlow(ctx);
  }
}

class Confetti extends Fx {
  constructor(env) {
    super(1.05);
    this.env = env;
    this.bits = Array.from({ length: 36 }, () => {
      const side = randInt(0, 3);
      let x, y, vx, vy;
      if (side === 0) {
        x = rand() * env.w;
        y = -10;
        vx = randRange(-80, 80);
        vy = randRange(220, 520);
      } else if (side === 1) {
        x = env.w + 10;
        y = rand() * env.h;
        vx = randRange(-520, -180);
        vy = randRange(-80, 80);
      } else if (side === 2) {
        x = rand() * env.w;
        y = env.h + 10;
        vx = randRange(-80, 80);
        vy = randRange(-520, -180);
      } else {
        x = -10;
        y = rand() * env.h;
        vx = randRange(180, 520);
        vy = randRange(-80, 80);
      }
      return { x, y, vx, vy, r: randRange(6, 16), c: rndColor(env), rot: rand() * TAU, vr: randRange(-8, 8) };
    });
  }
  update(dt) {
    this.step(dt);
    for (const b of this.bits) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
    }
  }
  draw(ctx) {
    const a = 1 - ease.inCubic(this.t);
    for (const b of this.bits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = rgba(b.c, a);
      ctx.fillRect(-b.r, -b.r * 0.45, b.r * 2, b.r * 0.9);
      ctx.restore();
    }
  }
}

class Sparkles extends Fx {
  constructor(env) {
    super(0.8);
    const o = origin(env, "random");
    this.bits = Array.from({ length: 28 }, () => ({
      x: o.x,
      y: o.y,
      a: rand() * TAU,
      s: randRange(140, 420),
      r: randRange(2, 7),
      c: rndColor(env),
    }));
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    for (const b of this.bits) {
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(b.a) * b.s * p, b.y + Math.sin(b.a) * b.s * p, b.r * (1 - this.t * 0.5), 0, TAU);
      ctx.fillStyle = rgba(b.c, a);
      ctx.fill();
    }
  }
}

class Flash extends Fx {
  constructor(env) {
    super(0.32);
    this.env = env;
    this.c = rndColor(env);
    this.mode = randInt(0, 2);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = this.t < 0.2 ? this.t / 0.2 : 1 - (this.t - 0.2) / 0.8;
    ctx.fillStyle = rgba(this.c, a * 0.85);
    if (this.mode === 0) ctx.fillRect(0, 0, this.env.w, this.env.h);
    else if (this.mode === 1) ctx.fillRect(0, 0, this.env.w, this.env.h * 0.5);
    else ctx.fillRect(this.env.w * 0.5, 0, this.env.w * 0.5, this.env.h);
  }
}

class Piston extends Fx {
  constructor(env) {
    super(0.55);
    this.env = env;
    this.count = randInt(3, 5);
    this.c = rndColor(env);
    this.dir = pick(["h", "v"]);
    this.from = rand() > 0.5 ? 1 : -1;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outBack(Math.min(this.t / 0.45, 1));
    const fade = this.t < 0.55 ? 1 : 1 - (this.t - 0.55) / 0.45;
    const { w, h } = this.env;
    for (let i = 0; i < this.count; i++) {
      ctx.fillStyle = rgba(i % 2 ? this.c : this.env.fg, fade * 0.9);
      if (this.dir === "h") {
        const bh = h / this.count;
        const y = i * bh;
        const ww = w * p;
        const x = this.from > 0 ? 0 : w - ww;
        ctx.fillRect(x, y + 4, ww, bh - 8);
      } else {
        const bw = w / this.count;
        const x = i * bw;
        const hh = h * p;
        const y = this.from > 0 ? 0 : h - hh;
        ctx.fillRect(x + 4, y, bw - 8, hh);
      }
    }
  }
}

class Strike extends Fx {
  constructor(env) {
    super(0.42);
    this.env = env;
    this.c = rndColor(env);
    this.vertical = rand() > 0.5;
    this.pos = this.vertical ? rand() * env.w : rand() * env.h;
    this.w = randRange(8, 28);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = this.t < 0.25 ? 1 : 1 - (this.t - 0.25) / 0.75;
    glow(ctx, this.env, this.c, 40);
    ctx.fillStyle = rgba(this.c, a);
    if (this.vertical) ctx.fillRect(this.pos - this.w / 2, 0, this.w, this.env.h);
    else ctx.fillRect(0, this.pos - this.w / 2, this.env.w, this.w);
    noGlow(ctx);
  }
}

class Corona extends Fx {
  constructor(env) {
    super(0.9);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
    this.n = 28;
    this.rot = rand() * TAU;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - ease.outQuad(this.t);
    const r = Math.min(this.env.w, this.env.h) * 0.48 * p;
    ctx.save();
    ctx.translate(this.o.x, this.o.y);
    ctx.rotate(this.rot + this.t * 0.4);
    for (let i = 0; i < this.n; i++) {
      const ang = (i / this.n) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.lineTo(Math.cos(ang + 0.08) * r * 0.72, Math.sin(ang + 0.08) * r * 0.72);
      ctx.closePath();
      ctx.fillStyle = rgba(i % 2 ? this.c : this.env.fg, a * 0.85);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Bubbles extends Fx {
  constructor(env) {
    super(1.15);
    this.bits = Array.from({ length: 18 }, (_, i) => ({
      x: rand() * env.w,
      y: env.h + randRange(20, 160),
      r: randRange(18, 70),
      s: randRange(180, 420),
      c: env.colors[i % env.colors.length],
      delay: i * 0.03,
    }));
    this.env = env;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    for (const b of this.bits) {
      const local = clamp((this.t - b.delay) / (1 - b.delay), 0, 1);
      const y = b.y - local * (this.env.h + 240);
      const a = local < 0.15 ? local / 0.15 : 1 - (local - 0.15) / 0.85;
      ctx.beginPath();
      ctx.arc(b.x, y, b.r * (0.6 + local * 0.4), 0, TAU);
      ctx.strokeStyle = rgba(b.c, clamp(a, 0, 1));
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }
}

class Dots extends Fx {
  constructor(env) {
    super(0.85);
    this.env = env;
    this.c = rndColor(env);
    this.n = 16;
    this.o = origin(env);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    for (let i = 0; i < this.n; i++) {
      const ang = (i / this.n) * TAU + this.t * 1.2;
      const r = 40 + p * Math.min(this.env.w, this.env.h) * 0.32;
      ctx.beginPath();
      ctx.arc(this.o.x + Math.cos(ang) * r, this.o.y + Math.sin(ang) * r, lerp(14, 3, p), 0, TAU);
      ctx.fillStyle = rgba(i % 2 ? this.c : this.env.fg, a);
      ctx.fill();
    }
  }
}

class Veil extends Fx {
  constructor(env) {
    super(0.65);
    this.env = env;
    this.c = rndColor(env);
    this.fromLeft = rand() > 0.5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.inOut(this.t);
    const w = this.env.w * 0.55;
    const x = this.fromLeft ? lerp(-w, this.env.w, p) : lerp(this.env.w, -w, p);
    ctx.fillStyle = rgba(this.c, 0.72);
    ctx.fillRect(x, 0, w, this.env.h);
  }
}

class WipeH extends Fx {
  constructor(env) {
    super(0.5);
    this.env = env;
    this.c = rndColor(env);
    this.top = rand() > 0.5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const h = this.env.h * p;
    ctx.fillStyle = rgba(this.c, 1 - this.t * 0.35);
    ctx.fillRect(0, this.top ? 0 : this.env.h - h, this.env.w, h);
  }
}

class WipeV extends Fx {
  constructor(env) {
    super(0.5);
    this.env = env;
    this.c = rndColor(env);
    this.left = rand() > 0.5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const w = this.env.w * p;
    ctx.fillStyle = rgba(this.c, 1 - this.t * 0.35);
    ctx.fillRect(this.left ? 0 : this.env.w - w, 0, w, this.env.h);
  }
}

class Grid extends Fx {
  constructor(env) {
    super(0.7);
    this.env = env;
    this.c = rndColor(env);
    this.cols = randInt(4, 8);
    this.rows = randInt(3, 6);
    this.seed = rand();
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const { w, h } = this.env;
    const cw = w / this.cols;
    const rh = h / this.rows;
    const a = 1 - ease.outQuad(this.t);
    const s = ease.outBack(Math.min(this.t * 1.6, 1));
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (((x + y + (this.seed * 10) | 0) & 1) === 0) continue;
        const cx = (x + 0.5) * cw;
        const cy = (y + 0.5) * rh;
        ctx.fillStyle = rgba((x + y) % 2 ? this.c : this.env.fg, a);
        ctx.fillRect(cx - (cw * 0.42 * s) / 1, cy - (rh * 0.42 * s) / 1, cw * 0.42 * s * 2, rh * 0.42 * s * 2);
      }
    }
  }
}

class Diamond extends Fx {
  constructor(env) {
    super(0.75);
    this.env = env;
    this.o = origin(env, "random");
    this.c = rndColor(env);
    this.max = Math.min(env.w, env.h) * randRange(0.2, 0.38);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outBack(this.t);
    const a = 1 - ease.outQuad(this.t);
    ctx.save();
    ctx.translate(this.o.x, this.o.y);
    ctx.rotate(Math.PI / 4 + this.t * 0.4);
    glow(ctx, this.env, this.c, 20);
    ctx.fillStyle = rgba(this.c, a);
    ctx.fillRect(-this.max * p, -this.max * p, this.max * 2 * p, this.max * 2 * p);
    noGlow(ctx);
    ctx.restore();
  }
}

class Hex extends Fx {
  constructor(env) {
    super(0.75);
    this.env = env;
    this.o = origin(env, "random");
    this.c = rndColor(env);
    this.max = Math.min(env.w, env.h) * randRange(0.18, 0.34);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outBack(this.t);
    const a = 1 - this.t;
    polyPath(ctx, this.o.x, this.o.y, this.max * p, 6, this.t * 0.6);
    ctx.fillStyle = rgba(this.c, a);
    ctx.fill();
    polyPath(ctx, this.o.x, this.o.y, this.max * p * 0.62, 6, this.t * 0.6);
    ctx.fillStyle = rgba(this.env.bg, a * 0.9);
    ctx.fill();
  }
}

class TriangleFx extends Fx {
  constructor(env) {
    super(0.72);
    this.env = env;
    this.bits = Array.from({ length: 7 }, () => ({
      x: rand() * env.w,
      y: rand() * env.h,
      r: randRange(40, 140),
      rot: rand() * TAU,
      c: rndColor(env),
    }));
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - this.t;
    for (const b of this.bits) {
      polyPath(ctx, b.x, b.y, b.r * p, 3, b.rot + this.t);
      ctx.fillStyle = rgba(b.c, a * 0.9);
      ctx.fill();
    }
  }
}

class StarFx extends Fx {
  constructor(env) {
    super(0.82);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
    this.max = Math.min(env.w, env.h) * 0.42;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outBack(this.t);
    const a = 1 - ease.outQuad(this.t);
    glow(ctx, this.env, this.c, 28);
    starPath(ctx, this.o.x, this.o.y, this.max * p, 5, 0.42, this.t * 0.8);
    ctx.fillStyle = rgba(this.c, a);
    ctx.fill();
    noGlow(ctx);
  }
}

class Moon extends Fx {
  constructor(env) {
    super(1.05);
    this.env = env;
    this.c = rndColor(env);
    this.from = pick(["l", "r"]);
    this.r = Math.min(env.w, env.h) * 0.28;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.inOut(this.t);
    const x = this.from === "l" ? lerp(-this.r, this.env.w + this.r, p) : lerp(this.env.w + this.r, -this.r, p);
    const y = this.env.h * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, this.r, 0, TAU);
    ctx.fillStyle = this.c;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + this.r * 0.38, y - this.r * 0.08, this.r * 0.86, 0, TAU);
    ctx.fillStyle = this.env.bg;
    ctx.fill();
  }
}

class Ring extends Fx {
  constructor(env) {
    super(0.9);
    this.env = env;
    this.o = origin(env);
    this.colors = [rndColor(env), rndColor(env), rndColor(env)];
    this.max = Math.min(env.w, env.h) * 0.7;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = 1 - this.t;
    for (let i = 0; i < 3; i++) {
      const p = ease.outExpo(clamp(this.t - i * 0.08, 0, 1));
      ctx.beginPath();
      ctx.arc(this.o.x, this.o.y, this.max * p * (1 - i * 0.12), 0, TAU);
      ctx.strokeStyle = rgba(this.colors[i], a);
      ctx.lineWidth = 10 - i * 2;
      ctx.stroke();
    }
  }
}

class Spiral extends Fx {
  constructor(env) {
    super(1.2);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
    this.n = 140;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const shown = Math.floor(this.n * ease.outCubic(this.t));
    const mag = Math.min(this.env.w, this.env.h) * 0.48;
    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      const pct = i / this.n;
      const r = mag * pct;
      const th = pct * Math.PI * 10;
      const x = this.o.x + Math.cos(th) * r;
      const y = this.o.y + Math.sin(th) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(this.c, 1 - this.t * 0.5);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

class Pinwheel extends Fx {
  constructor(env) {
    super(1.0);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
    this.blades = 8;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    const r = Math.min(this.env.w, this.env.h) * 0.4 * p;
    ctx.save();
    ctx.translate(this.o.x, this.o.y);
    ctx.rotate(this.t * 3.2);
    for (let i = 0; i < this.blades; i++) {
      ctx.rotate(TAU / this.blades);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.45, r * 0.12, r, 0);
      ctx.quadraticCurveTo(r * 0.45, -r * 0.12, 0, 0);
      ctx.fillStyle = rgba(i % 2 ? this.c : this.env.fg, a * 0.9);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Zigzag extends Fx {
  constructor(env) {
    super(0.7);
    this.env = env;
    this.c = rndColor(env);
    this.y = randRange(env.h * 0.2, env.h * 0.8);
    this.amp = randRange(40, 110);
    this.fromRight = rand() > 0.5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outQuart(this.t);
    const a = 1 - this.t * 0.4;
    const w = this.env.w;
    const steps = 18;
    ctx.beginPath();
    const start = this.fromRight ? w : 0;
    const dir = this.fromRight ? -1 : 1;
    ctx.moveTo(start, this.y);
    const drawn = steps * p;
    for (let i = 1; i <= drawn; i++) {
      const x = start + dir * (i / steps) * w;
      const y = this.y + (i % 2 === 0 ? -this.amp : this.amp);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(this.c, a);
    ctx.lineWidth = 10;
    ctx.lineJoin = "miter";
    ctx.stroke();
  }
}

class Squiggle extends Fx {
  constructor(env) {
    super(0.95);
    this.env = env;
    this.c = rndColor(env);
    this.pts = Array.from({ length: 8 }, () => ({
      x: rand() * env.w,
      y: rand() * env.h,
    }));
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const n = Math.max(2, Math.floor(this.pts.length * p));
    ctx.beginPath();
    ctx.moveTo(this.pts[0].x, this.pts[0].y);
    for (let i = 1; i < n; i++) {
      const prev = this.pts[i - 1];
      const cur = this.pts[i];
      const mx = (prev.x + cur.x) / 2;
      const my = (prev.y + cur.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.strokeStyle = rgba(this.c, 1 - this.t * 0.3);
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

class Prism extends Fx {
  constructor(env) {
    super(0.85);
    this.env = env;
    this.o = origin(env);
    this.n = randInt(3, 6);
    this.c = rndColor(env);
    this.rot = (randInt(0, 3) * Math.PI) / 2;
    this.max = Math.min(env.w, env.h) * randRange(0.22, 0.4);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - this.t;
    polyPath(ctx, this.o.x, this.o.y, this.max * p, this.n, this.rot);
    ctx.strokeStyle = rgba(this.c, a);
    ctx.lineWidth = 8;
    ctx.stroke();
    polyPath(ctx, this.o.x, this.o.y, this.max * p * 0.7, this.n, this.rot);
    ctx.fillStyle = rgba(this.c, a * 0.25);
    ctx.fill();
  }
}

class Ufo extends Fx {
  constructor(env) {
    super(1.05);
    this.env = env;
    this.c = rndColor(env);
    this.y = randRange(env.h * 0.25, env.h * 0.7);
    this.fromLeft = rand() > 0.5;
    this.rx = Math.min(env.w, env.h) * 0.16;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.inOut(this.t);
    const x = this.fromLeft ? lerp(-80, this.env.w + 80, p) : lerp(this.env.w + 80, -80, p);
    const bob = Math.sin(this.t * Math.PI * 4) * 12;
    ctx.beginPath();
    ctx.ellipse(x, this.y + bob, this.rx, this.rx * 0.38, 0, 0, TAU);
    ctx.fillStyle = this.c;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, this.y + bob - this.rx * 0.18, this.rx * 0.45, this.rx * 0.28, 0, 0, TAU);
    ctx.fillStyle = this.env.fg;
    ctx.fill();
    ctx.fillStyle = rgba(this.c, 0.25 * (1 - this.t));
    ctx.beginPath();
    ctx.moveTo(x - 20, this.y + bob);
    ctx.lineTo(x - 70, this.env.h);
    ctx.lineTo(x + 70, this.env.h);
    ctx.lineTo(x + 20, this.y + bob);
    ctx.fill();
  }
}

class Clay extends Fx {
  constructor(env) {
    super(0.95);
    this.env = env;
    this.c = rndColor(env);
    const n = randInt(7, 12);
    const o = origin(env, "random");
    this.pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU;
      const r = randRange(40, 160);
      return { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r };
    });
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    ctx.beginPath();
    const pts = this.pts;
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p0 = pts[i % n];
      const p1 = pts[(i + 1) % n];
      const mx = lerp(this.env.w / 2, (p0.x + p1.x) / 2, p);
      const my = lerp(this.env.h / 2, (p0.y + p1.y) / 2, p);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(lerp(this.env.w / 2, p0.x, p), lerp(this.env.h / 2, p0.y, p), mx, my);
    }
    ctx.fillStyle = rgba(this.c, a * 0.9);
    ctx.fill();
  }
}

class Kaleido extends Fx {
  constructor(env) {
    super(0.95);
    this.env = env;
    this.c = rndColor(env);
    this.c2 = rndColor(env);
    this.o = origin(env);
    this.n = 10;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    const r = Math.min(this.env.w, this.env.h) * 0.42 * p;
    ctx.save();
    ctx.translate(this.o.x, this.o.y);
    ctx.rotate(this.t * 0.8);
    for (let i = 0; i < this.n; i++) {
      ctx.rotate(TAU / this.n);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, 0);
      ctx.lineTo(r * 0.55, r * 0.28);
      ctx.closePath();
      ctx.fillStyle = rgba(i % 2 ? this.c : this.c2, a * 0.85);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Vortex extends Fx {
  constructor(env) {
    super(1.15);
    this.env = env;
    this.o = origin(env);
    this.colors = env.colors.slice();
    this.arms = 5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t * 0.7;
    ctx.save();
    ctx.translate(this.o.x, this.o.y);
    ctx.rotate(this.t * 4);
    for (let arm = 0; arm < this.arms; arm++) {
      ctx.strokeStyle = rgba(this.colors[arm % this.colors.length], a);
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * p;
        const r = t * Math.min(this.env.w, this.env.h) * 0.48;
        const ang = t * 6 + (arm * TAU) / this.arms;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Lightning extends Fx {
  constructor(env) {
    super(0.45);
    this.env = env;
    this.c = rndColor(env);
    const x0 = rand() * env.w;
    this.pts = [{ x: x0, y: 0 }];
    let x = x0;
    let y = 0;
    while (y < env.h) {
      x += randRange(-70, 70);
      y += randRange(30, 80);
      this.pts.push({ x, y });
    }
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = this.t < 0.2 ? 1 : 1 - (this.t - 0.2) / 0.8;
    glow(ctx, this.env, this.c, 32);
    ctx.beginPath();
    ctx.moveTo(this.pts[0].x, this.pts[0].y);
    for (const p of this.pts) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = rgba(this.env.fg, a);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = rgba(this.c, a);
    ctx.lineWidth = 7;
    ctx.stroke();
    noGlow(ctx);
  }
}

class Chevron extends Fx {
  constructor(env) {
    super(0.62);
    this.env = env;
    this.c = rndColor(env);
    this.dir = pick([1, -1]);
    this.count = 6;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outCubic(this.t);
    const a = 1 - this.t;
    const { w, h } = this.env;
    for (let i = 0; i < this.count; i++) {
      const y = ((i + 0.5) / this.count) * h;
      const spread = (80 + i * 18) * p;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - spread * this.dir, y - 18);
      ctx.lineTo(w * 0.5 + 10 * this.dir, y);
      ctx.lineTo(w * 0.5 - spread * this.dir, y + 18);
      ctx.strokeStyle = rgba(this.c, a);
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }
}

class Bloom extends Fx {
  constructor(env) {
    super(0.95);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - ease.outQuad(this.t);
    const r = Math.min(this.env.w, this.env.h) * 0.55 * p;
    const g = ctx.createRadialGradient(this.o.x, this.o.y, r * 0.1, this.o.x, this.o.y, r);
    g.addColorStop(0, rgba(this.env.fg, a * 0.9));
    g.addColorStop(0.45, rgba(this.c, a * 0.55));
    g.addColorStop(1, rgba(this.c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.env.w, this.env.h);
  }
}

class Shards extends Fx {
  constructor(env) {
    super(0.85);
    this.env = env;
    const o = origin(env);
    this.bits = Array.from({ length: 16 }, () => ({
      x: o.x,
      y: o.y,
      vx: randRange(-500, 500),
      vy: randRange(-500, 500),
      r: randRange(20, 80),
      rot: rand() * TAU,
      vr: randRange(-6, 6),
      n: randInt(3, 5),
      c: rndColor(env),
    }));
  }
  update(dt) {
    this.step(dt);
    for (const b of this.bits) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
    }
  }
  draw(ctx) {
    const a = 1 - this.t;
    const s = 1 - this.t * 0.3;
    for (const b of this.bits) {
      polyPath(ctx, b.x, b.y, b.r * s, b.n, b.rot);
      ctx.fillStyle = rgba(b.c, a);
      ctx.fill();
    }
  }
}

class Bars extends Fx {
  constructor(env) {
    super(0.55);
    this.env = env;
    this.c = rndColor(env);
    this.n = randInt(7, 13);
    this.vertical = rand() > 0.5;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.outExpo(this.t);
    const a = 1 - this.t * 0.4;
    const { w, h } = this.env;
    for (let i = 0; i < this.n; i++) {
      const t = (i + 0.5) / this.n;
      ctx.fillStyle = rgba(i % 2 ? this.c : this.env.fg, a);
      if (this.vertical) {
        const x = t * w;
        const hh = h * p * (0.4 + (i % 5) * 0.12);
        ctx.fillRect(x - 8, (h - hh) / 2, 16, hh);
      } else {
        const y = t * h;
        const ww = w * p * (0.4 + (i % 5) * 0.12);
        ctx.fillRect((w - ww) / 2, y - 8, ww, 16);
      }
    }
  }
}

class Scanlines extends Fx {
  constructor(env) {
    super(0.5);
    this.env = env;
    this.c = rndColor(env);
    this.offset = rand() * 20;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = this.t < 0.3 ? 1 : 1 - (this.t - 0.3) / 0.7;
    ctx.fillStyle = rgba(this.c, a * 0.55);
    ctx.fillRect(0, 0, this.env.w, this.env.h);
    ctx.fillStyle = rgba(this.env.fg, a * 0.18);
    for (let y = this.offset; y < this.env.h; y += 8) {
      ctx.fillRect(0, y, this.env.w, 3);
    }
  }
}

class Rain extends Fx {
  constructor(env) {
    super(1.05);
    this.env = env;
    this.drops = Array.from({ length: 40 }, () => ({
      x: rand() * env.w,
      y: randRange(-200, -10),
      l: randRange(24, 90),
      s: randRange(500, 1100),
      w: randRange(2, 5),
      c: rndColor(env),
    }));
  }
  update(dt) {
    this.step(dt);
    for (const d of this.drops) d.y += d.s * dt;
  }
  draw(ctx) {
    const a = 1 - this.t * 0.5;
    for (const d of this.drops) {
      ctx.strokeStyle = rgba(d.c, a);
      ctx.lineWidth = d.w;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.l);
      ctx.stroke();
    }
  }
}

class Timer extends Fx {
  constructor(env) {
    super(0.95);
    this.env = env;
    this.o = origin(env);
    this.c = rndColor(env);
    this.r = Math.min(env.w, env.h) * 0.28;
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const a = 1 - this.t * 0.3;
    ctx.beginPath();
    ctx.arc(this.o.x, this.o.y, this.r, -Math.PI / 2, -Math.PI / 2 + TAU * ease.outCubic(this.t));
    ctx.strokeStyle = rgba(this.c, a);
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.o.x, this.o.y, this.r * 0.72, 0, TAU);
    ctx.strokeStyle = rgba(this.env.fg, a * 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

class PaletteWipe extends Fx {
  constructor(env) {
    super(0.7);
    this.env = env;
    this.c = env.bg;
    this.mode = randInt(0, 3);
  }
  update(dt) {
    this.step(dt);
  }
  draw(ctx) {
    const p = ease.inOut(this.t);
    ctx.fillStyle = this.c;
    const { w, h } = this.env;
    if (this.mode === 0) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.hypot(w, h) * p, 0, TAU);
      ctx.fill();
    } else if (this.mode === 1) {
      ctx.fillRect(0, 0, w * p, h);
    } else if (this.mode === 2) {
      ctx.fillRect(0, h * (1 - p), w, h * p);
    } else {
      ctx.fillRect(w * (1 - p) * 0.5, h * (1 - p) * 0.5, w * p, h * p);
    }
  }
}

const MAKERS = {
  burst: Burst,
  confetti: Confetti,
  sparkles: Sparkles,
  flash: Flash,
  piston: Piston,
  strike: Strike,
  corona: Corona,
  bubbles: Bubbles,
  dots: Dots,
  veil: Veil,
  wipeH: WipeH,
  wipeV: WipeV,
  grid: Grid,
  diamond: Diamond,
  hex: Hex,
  triangle: TriangleFx,
  star: StarFx,
  moon: Moon,
  ring: Ring,
  spiral: Spiral,
  pinwheel: Pinwheel,
  zigzag: Zigzag,
  squiggle: Squiggle,
  prism: Prism,
  ufo: Ufo,
  clay: Clay,
  kaleido: Kaleido,
  vortex: Vortex,
  lightning: Lightning,
  chevron: Chevron,
  bloom: Bloom,
  shards: Shards,
  bars: Bars,
  scanlines: Scanlines,
  rain: Rain,
  timer: Timer,
  paletteWipe: PaletteWipe,
};

export function createEffect(name, env) {
  const Ctor = MAKERS[name] || Burst;
  return new Ctor(env);
}

export const EFFECT_NAMES = Object.keys(MAKERS);
