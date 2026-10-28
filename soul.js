/* ============================================================
   SOUL — 情绪解析 / 调色 / 迎宾音效
   纯前端，无外部依赖。挂到 window.Soul。
   ============================================================ */
(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- 情绪词典 ---------------- */
  // [valence -1..1, arousal 0..1]
  const LEX = {
    爱: [0.85, 0.55], 喜欢: [0.8, 0.5], 喜悦: [0.9, 0.6], 开心: [0.85, 0.55],
    快乐: [0.85, 0.55], 幸福: [0.9, 0.45], 温暖: [0.75, 0.3], 温柔: [0.7, 0.25],
    平静: [0.45, 0.12], 安静: [0.35, 0.1], 宁静: [0.4, 0.1], 安心: [0.6, 0.2],
    希望: [0.7, 0.45], 期待: [0.65, 0.5], 感动: [0.75, 0.5], 浪漫: [0.7, 0.4],
    美: [0.6, 0.35], 漂亮: [0.65, 0.35], 灿烂: [0.75, 0.55], 明亮: [0.65, 0.4],
    自由: [0.6, 0.5], 勇气: [0.6, 0.55], 骄傲: [0.55, 0.5], 感激: [0.75, 0.35],
    恨: [-0.85, 0.75], 愤怒: [-0.85, 0.85], 生气: [-0.7, 0.7], 怒: [-0.8, 0.8],
    讨厌: [-0.7, 0.55], 厌恶: [-0.75, 0.55], 恶心: [-0.8, 0.6], 痛苦: [-0.8, 0.65],
    悲伤: [-0.8, 0.35], 难过: [-0.75, 0.35], 哭: [-0.75, 0.5], 眼泪: [-0.7, 0.4],
    孤独: [-0.6, 0.25], 寂寞: [-0.55, 0.2], 失落: [-0.6, 0.3], 绝望: [-0.9, 0.5],
    忧郁: [-0.6, 0.2], 沉重: [-0.5, 0.3], 疲惫: [-0.45, 0.2], 累: [-0.4, 0.15],
    焦虑: [-0.55, 0.7], 紧张: [-0.4, 0.7], 恐惧: [-0.7, 0.85], 害怕: [-0.65, 0.8],
    惊慌: [-0.6, 0.9], 不安: [-0.5, 0.6], 压抑: [-0.6, 0.5], 窒息: [-0.7, 0.75],
    疯狂: [-0.3, 0.9], 混乱: [-0.35, 0.8], 眩晕: [-0.3, 0.7], 炽热: [0.35, 0.85],
    燃烧: [0.25, 0.85], 爆炸: [0.1, 0.95], 沸腾: [0.2, 0.9], 热烈: [0.65, 0.8],
    冷: [-0.2, 0.15], 冰冷: [-0.35, 0.15], 寂静: [0.1, 0.05], 空: [-0.1, 0.1],
    梦: [0.4, 0.3], 星空: [0.55, 0.35], 宇宙: [0.4, 0.4], 深渊: [-0.45, 0.55],
    光: [0.6, 0.45], 黑暗: [-0.5, 0.4], 夜: [-0.15, 0.15], 黎明: [0.6, 0.45],
    春天: [0.65, 0.4], 夏天: [0.55, 0.65], 秋天: [0.2, 0.25], 冬天: [-0.2, 0.2],
    好: [0.5, 0.3], 坏: [-0.5, 0.4], 对: [0.3, 0.2], 错: [-0.4, 0.35],
    可怕: [-0.7, 0.75], 失去: [-0.6, 0.4], 离开: [-0.4, 0.3], 想念: [0.3, 0.35],
    夜色: [-0.2, 0.18], 压: [-0.35, 0.4], 沉默: [-0.25, 0.12], 空荡: [-0.45, 0.2],
    想念你: [0.35, 0.4], 回不来: [-0.65, 0.35], 一切都会好: [0.75, 0.45],
    阳光: [0.6, 0.45], 咖啡: [0.35, 0.3], 海面: [0.4, 0.2], 浪声: [0.35, 0.18],
    谢谢: [0.65, 0.25], 抱歉: [-0.35, 0.25], 再见: [-0.2, 0.25], 你好: [0.45, 0.3],
    love: [0.85, 0.6], joy: [0.85, 0.6], happy: [0.8, 0.55], hope: [0.65, 0.45],
    calm: [0.4, 0.12], peace: [0.5, 0.15], warm: [0.6, 0.3], light: [0.55, 0.4],
    beautiful: [0.7, 0.4], dream: [0.45, 0.3], free: [0.55, 0.5], alive: [0.7, 0.7],
    hate: [-0.85, 0.75], angry: [-0.75, 0.8], fear: [-0.7, 0.8], sad: [-0.75, 0.3],
    pain: [-0.8, 0.6], dark: [-0.5, 0.35], cold: [-0.25, 0.15], lonely: [-0.6, 0.2],
    dead: [-0.9, 0.3], death: [-0.85, 0.35], void: [-0.4, 0.4], fire: [0.25, 0.9],
    storm: [-0.2, 0.85], chaos: [-0.3, 0.85], quiet: [0.3, 0.08], lost: [-0.55, 0.4],
    forever: [0.3, 0.35], time: [0.05, 0.25], data: [0.1, 0.35], collapse: [-0.5, 0.7],
  };

  const NEG = /[不没无别未莫]/;
  const INTENS = /[很太超极特非十百千万]/;

  function tokenize(text) {
    const out = [];
    const latin = text.match(/[a-zA-Z']+/g) || [];
    for (const w of latin) out.push(w.toLowerCase());
    let i = 0;
    const s = text.replace(/\s+/g, '');
    while (i < s.length) {
      if (/[a-zA-Z]/.test(s[i])) { i++; continue; }
      let hit = null;
      for (let len = 3; len >= 1; len--) {
        const w = s.slice(i, i + len);
        if (w.length === len && LEX[w]) { hit = w; break; }
      }
      if (hit) { out.push(hit); i += hit.length; }
      else i++;
    }
    return out;
  }

  function analyzeText(raw) {
    const text = String(raw || '').slice(0, 4000);
    const toks = tokenize(text);
    let vSum = 0, aSum = 0, hits = 0, pos = 0, neg = 0;

    const s = text.replace(/\s+/g, '');
    for (const w of toks) {
      const entry = LEX[w];
      if (!entry) continue;
      hits++;
      let v = entry[0], a = entry[1];
      const idx = s.indexOf(w);
      const pre = idx > 0 ? s.slice(Math.max(0, idx - 2), idx) : '';
      if (NEG.test(pre)) v *= -0.72;
      if (INTENS.test(pre)) { v = clamp(v * 1.25, -1, 1); a = clamp(a * 1.2, 0, 1); }
      vSum += v; aSum += a;
      if (v > 0) pos++; else if (v < 0) neg++;
    }

    let valence = hits ? vSum / hits : 0;
    let arousal = hits ? aSum / hits : 0.22;

    const ex = (text.match(/[!！]/g) || []).length;
    const q = (text.match(/[?？]/g) || []).length;
    const ell = (text.match(/…|\.\.\./g) || []).length;
    arousal = clamp(arousal + ex * 0.06 + q * 0.03, 0, 1);
    valence = clamp(valence - ell * 0.05, -1, 1);

    if (!hits) {
      // no lexicon hit: infer from punctuation length / digits
      valence = clamp((text.length % 7) / 20 - 0.1, -0.3, 0.3);
      arousal = clamp(0.2 + ex * 0.08, 0.15, 0.55);
    }

    const mood = moodOf(valence, arousal);
    const palette = paletteOf(mood, valence, arousal);

    return {
      kind: 'text',
      valence, arousal,
      label: mood.label,
      moodKey: mood.key,
      colors: palette.colors,
      mode: palette.mode,
      stats: {
        chars: text.length,
        tokens: toks.length,
        hits,
        pos, neg,
        ex, q,
      },
    };
  }

  function moodOf(v, a) {
    if (v > 0.22 && a > 0.55) return { key: 'joy', label: '炽烈 · 喜悦', hue: 42 };
    if (v > 0.12 && a <= 0.55) return { key: 'calm', label: '温柔 · 平静', hue: 188 };
    if (v < -0.2 && a > 0.6) return { key: 'anger', label: '灼烧 · 愤怒', hue: 8 };
    if (v < -0.12 && a <= 0.55) return { key: 'sad', label: '深蓝 · 忧郁', hue: 228 };
    if (Math.abs(v) <= 0.2 && a > 0.6) return { key: 'tense', label: '电紫 · 紧张', hue: 288 };
    if (Math.abs(v) <= 0.2) return { key: 'cold', label: '银白 · 冷静', hue: 205 };
    if (v > 0) return { key: 'warm', label: '琥珀 · 温热', hue: 30 };
    return { key: 'dusk', label: '暮色 · 低落', hue: 265 };
  }

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  }

  function paletteOf(mood, v, a) {
    const sat = clamp(0.25 + a * 0.55, 0.2, 0.85);
    const light = clamp(0.62 - Math.max(0, -v) * 0.18 + a * 0.06, 0.42, 0.78);
    const h = mood.hue;
    const mode = a > 0.62 ? 'gradient' : v < -0.3 ? 'mono' : 'multi';
    const spread = mode === 'multi' ? 30 : mode === 'gradient' ? 22 : 6;
    const colors = [
      hsl(h - spread * 0.6, sat * 0.8, clamp(light + 0.16, 0, 0.92)),
      hsl(h, sat, light),
      hsl(h + spread, sat * 0.92, clamp(light - 0.08, 0.22, 0.86)),
    ];
    return { colors, mode };
  }

  /* ---------------- 图像 ---------------- */
  function analyzeImage(img) {
    const S = 72;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;

    let rSum = 0, gSum = 0, bSum = 0, lSum = 0, sSum = 0, n = 0;
    let hx = 0, hy = 0, vMin = 1, vMax = 0;
    const bins = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2;
      const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((g - b) / (mx - mn)) % 6;
        else if (mx === g) h = (b - r) / (mx - mn) + 2;
        else h = (r - g) / (mx - mn) + 4;
        h *= 60;
      }
      rSum += r; gSum += g; bSum += b; lSum += l; sSum += s; n++;
      vMin = Math.min(vMin, l); vMax = Math.max(vMax, l);
      const rad = (h * Math.PI) / 180;
      hx += Math.cos(rad) * s; hy += Math.sin(rad) * s;

      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      bins.set(key, e);
    }

    const avgL = lSum / n, avgS = sSum / n;
    const hue = ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360;
    const contrast = vMax - vMin;

    // dominant colors
    const top = [...bins.values()].sort((x, y) => y.n - x.n).slice(0, 8);
    const dom = top.map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
    const filtered = dom.filter(([r, g, b]) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mx > 0.08 && !(mx - mn < 0.02 && mx > 0.92);
    });
    const pick = (filtered.length ? filtered : dom).slice(0, 3);

    // mood mapping: warm + saturated + bright => positive / aroused
    const warmth = clamp((Math.cos(((hue - 35) * Math.PI) / 180) + 1) / 2, 0, 1);
    const valence = clamp((avgL - 0.42) * 1.6 + (warmth - 0.45) * 0.7 + (avgS - 0.35) * 0.5, -0.95, 0.95);
    const arousal = clamp(avgS * 0.85 + contrast * 0.55 + (1 - Math.abs(avgL - 0.5) * 1.4) * 0.2, 0.05, 0.98);

    const mood = moodOf(valence, arousal);
    const auto = paletteOf(mood, valence, arousal);
    const mode = avgS > 0.55 && contrast > 0.45 ? 'gradient' : dom.length > 2 && avgS > 0.35 ? 'multi' : 'mono';
    const colors = pick.length >= 3 ? pick.map((c) => c.map((x) => clamp(x * 1.15, 0, 1))) : auto.colors;

    return {
      kind: 'image',
      valence, arousal,
      label: mood.label,
      moodKey: mood.key,
      colors,
      mode,
      stats: {
        px: n,
        hue: Math.round(hue),
        sat: +avgS.toFixed(2),
        light: +avgL.toFixed(2),
        contrast: +contrast.toFixed(2),
        colors: pick.length,
      },
    };
  }

  /* ---------------- 音效 ---------------- */
  /* ============================================================
     VOICE FIRST
     a calm british mezzo, light filtered air, no mechanical hits.
     ============================================================ */
  const Audio = {
    ctx: null,
    master: null,
    verb: null,
    ready: false,
    muted: false,
    voice: null,
    analyser: null,
    speaking: false,

    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());

      const master = (this.master = ctx.createGain());
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.75;
      master.connect(this.analyser);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this.makeIR(ctx, 2.4, 2.4);
      const wet = ctx.createGain();
      wet.gain.value = 0.34;
      this.verb.connect(wet);
      wet.connect(master);

      this.ready = true;
      this.pickVoice();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => this.pickVoice();
      }
      return true;
    },

    makeIR(ctx, seconds, decay) {
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - Math.exp(-i / 500)) * 0.5;
        }
      }
      return buf;
    },

    pickVoice() {
      if (!window.speechSynthesis) return;
      const vs = window.speechSynthesis.getVoices() || [];
      const female = /libby|sonia|hazel|serena|kate|susan|samantha|victoria|emma|female|zira|aria|jenny|michelle/i;
      const gb = /en[-_]GB/i;
      this.voice =
        vs.find((v) => gb.test(v.lang) && female.test(v.name)) ||
        vs.find((v) => gb.test(v.lang)) ||
        vs.find((v) => /en[-_]/i.test(v.lang) && female.test(v.name)) ||
        vs.find((v) => /en[-_]/i.test(v.lang)) ||
        null;
    },

    bus(node) {
      node.connect(this.master);
      if (this.verb) node.connect(this.verb);
    },

    /* a barely-there glass tick for controls */
    tick() {
      if (!this.init() || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      o.type = 'sine';
      o.frequency.setValueAtTime(2200 + Math.random() * 600, t);
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 2.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      o.connect(bp); bp.connect(g); this.bus(g);
      o.start(t); o.stop(t + 0.07);
    },

    /* breath of air: channel opens */
    air(dur, gain) {
      if (!this.init() || this.muted) return;
      const ctx = this.ctx;
      const d = dur || 0.9;
      const len = Math.floor(ctx.sampleRate * d);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const x = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * x) * 0.6;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.7;
      const t = ctx.currentTime;
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.linearRampToValueAtTime(2400, t + d * 0.7);
      const g = ctx.createGain();
      g.gain.value = gain || 0.022;
      src.connect(bp); bp.connect(g); this.bus(g);
      src.start(t);
    },

    /* soft filtered pad under the voice */
    pad(freq, dur, gain, when) {
      if (!this.init() || this.muted) return;
      const ctx = this.ctx;
      const t = when === undefined ? ctx.currentTime : when;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sine';
      o2.type = 'triangle';
      o.frequency.value = freq;
      o2.frequency.value = freq * 1.5;
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain || 0.016, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
      o.connect(lp); o2.connect(lp); lp.connect(g); this.bus(g);
      o.start(t); o2.start(t);
      o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    },

    /* the voice: slow, low, unhurried */
    speak(text, delay, opts) {
      if (!window.speechSynthesis) return;
      this._q = this._q || [];
      this._q.push({ text: text, opts: opts || {} });
      const kick = () => this._drain();
      if (delay) setTimeout(kick, delay);
      else setTimeout(kick, 0);
    },

    _drain() {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (this._busy) return;
      if (!this._q || !this._q.length) return;

      const item = this._q.shift();
      this._busy = true;
      this.pickVoice();

      const u = new SpeechSynthesisUtterance(item.text);
      if (this.voice) u.voice = this.voice;
      u.lang = (this.voice && this.voice.lang) || 'en-GB';
      u.rate = item.opts.rate || 0.82;
      u.pitch = item.opts.pitch || 0.94;
      u.volume = 1.0;

      const done = () => {
        clearTimeout(this._safety);
        this._busy = false;
        this.speaking = false;
        setTimeout(() => this._drain(), 320);
      };

      u.onend = done;
      u.onerror = done;

      clearTimeout(this._safety);
      this._safety = setTimeout(() => {
        if (this._busy) {
          try { synth.cancel(); } catch (e) { /* ignore */ }
          this._busy = false;
          this.speaking = false;
        }
      }, 14000);

      this.speaking = true;
      try { synth.speak(u); } catch (e) { done(); }
    },

    say(text, delay) {
      if (this.muted) return;
      this.init();
      const d = delay || 0;
      setTimeout(() => {
        this.air(0.7, 0.018);
        this.pad(196, 2.6, 0.012);
        this.pad(294, 2.2, 0.008);
      }, Math.max(0, d - 350));
      this.speak(text, d);
    },

    welcome() {
      if (!this.init()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.05;
      this.air(1.8, 0.02);
      this.pad(146.8, 3.6, 0.02, t);
      this.pad(220, 3.2, 0.012, t + 0.1);
      this.pad(293.7, 2.8, 0.008, t + 0.2);
      [1760, 2637].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + 0.2 + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.004, t + 0.25 + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.0002, t + 1.8 + i * 0.3);
        o.connect(g); this.bus(g);
        o.start(t); o.stop(t + 2.4);
      });
    },
  };

  /* ---------------- 语音库：54 句，按情境与情绪 ---------------- */
  const OPENERS = ['Read.', 'Done.', 'It is in.', 'I have it.', 'As you asked.'];

  const REPLIES = {
    joy: [
      'Warmth. I have let it into the horizon.',
      'There is light in this one. Gold suits it.',
      'A good signal. I am keeping it.',
      'This one lifts. I have opened the field for it.',
      'Bright, and unhurried. Noted.',
    ],
    calm: [
      'Calm. The field settles with you.',
      'Quiet. I have given it blue.',
      'Steady. Nothing needs doing.',
      'A slow signal. I will keep it still.',
      'Stillness reads well on you.',
    ],
    anger: [
      'Heat. I have let the red in.',
      'This one burns. Noted.',
      'Anger reads clearly. I will hold it.',
      'Sharp edges. The horizon takes them.',
      'I have made room for the fire.',
    ],
    sad: [
      'Something heavy here. Deep blue.',
      'This one sinks. I have dimmed the field.',
      'Loss. I will keep it quiet.',
      'The weight is real. I am not measuring it away.',
      'Blue, and slower. Noted.',
    ],
    tense: [
      'Unrest. Violet, and a faster pulse.',
      'Tension, clean and bright. Noted.',
      'Nervous energy. I have pulled the colours apart.',
      'Something is about to move. I can feel it.',
      'Fast signal. Violet, then.',
    ],
    cold: [
      'Neutral. Silver, then.',
      'Nothing loud. The field stays pale.',
      'Read. I will keep it quiet.',
      'Even. No colour asked for more.',
      'Balanced. I have left it alone.',
    ],
    warm: [
      'Amber. A human colour.',
      'Warm and unhurried. Kept.',
      'Gentle. I like this one.',
      'Soft light. I have let it stay.',
      'This one is kind. Noted.',
    ],
    dusk: [
      'A low one. Violet grey.',
      'Weight without a name. Noted.',
      'Dusk. I will hold it here.',
      'Not sad, not quiet. Something between.',
      'I have kept the grey for you.',
    ],
  };

  const IMAGE_LINES = [
    'The palette came from the image itself.',
    'I took the colours directly from the frame.',
    'Its own light, redirected.',
    'The image chose this palette. I only turned it.',
  ];

  const GREETINGS = [
    'You are welcome.',
    'Welcome back.',
    'I am here.',
    'Good to see you.',
    'All systems are nominal.',
  ];

  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function replyFor(rep) {
    let line = pickOne(REPLIES[rep.moodKey] || REPLIES.cold);
    if (Math.random() < 0.28) line = pickOne(OPENERS) + ' ' + line;
    if (rep.kind === 'image' && Math.random() < 0.5) line += ' ' + pickOne(IMAGE_LINES);
    else if (Math.random() < 0.16) line += ' Holding it here.';
    return line;
  }

  function greeting() {
    return pickOne(GREETINGS);
  }

  window.Soul = {
    analyzeText,
    analyzeImage,
    audio: Audio,
    replyFor,
    greeting,
    hsl,
    moodOf,
    paletteOf,
  };
})();
