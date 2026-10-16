// مشغّل ومُصدّر الفيديو: يرسم المشاهد على Canvas مع حركة الكاميرا والترجمة والصوت
import { blobURL } from './util.js';
import { RATIO_LIST } from './styles.js';

export const MIN_SCENE = 3;

export function sceneDuration(sc) {
  if (sc.manualDur) return sc.manualDur;
  return Math.max(MIN_SCENE, (sc.audioDur || 0) + 0.6);
}

export function totalDuration(project) {
  return project.scenes.reduce((a, s) => a + sceneDuration(s), 0);
}

export function dims(ratio) {
  const r = RATIO_LIST.find((x) => x.id === ratio) || RATIO_LIST[0];
  return { w: r.w, h: r.h };
}

function loadImg(blob) {
  return new Promise((res) => {
    if (!blob) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = blobURL(blob);
  });
}

function loadVideo(blob) {
  return new Promise((res) => {
    if (!blob) return res(null);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.loop = true;
    v.onloadeddata = () => res(v);
    v.onerror = () => res(null);
    v.src = blobURL(blob);
  });
}

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCover(ctx, src, sw, sh, W, H, scale, ox, oy) {
  const k = Math.max(W / sw, H / sh) * scale;
  const dw = sw * k;
  const dh = sh * k;
  const x = (W - dw) / 2 + ox * (dw - W);
  const y = (H - dh) / 2 + oy * (dh - H);
  ctx.drawImage(src, x, y, dw, dh);
}

export class Renderer {
  constructor(project, canvas) {
    this.p = project;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const { w, h } = dims(project.ratio);
    canvas.width = w;
    canvas.height = h;
    this.W = w;
    this.H = h;
    this.imgs = [];
    this.vids = [];
    this.starts = [];
    this.ready = false;
  }

  async load() {
    let t = 0;
    this.starts = [];
    for (const sc of this.p.scenes) {
      this.starts.push(t);
      t += sceneDuration(sc);
    }
    this.total = t;
    this.imgs = await Promise.all(this.p.scenes.map((s) => loadImg(s.image)));
    this.vids = await Promise.all(this.p.scenes.map((s) => loadVideo(s.clip)));
    this.ready = true;
  }

  locate(time) {
    let i = this.starts.length - 1;
    while (i > 0 && this.starts[i] > time) i--;
    return i;
  }

  // يرسم الإطار عند الزمن time (بالثواني)
  draw(time) {
    const { ctx, W, H, p } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!p.scenes.length) return;
    const i = this.locate(Math.min(time, this.total - 0.001));
    const sc = p.scenes[i];
    const dur = sceneDuration(sc);
    const lt = Math.max(0, time - this.starts[i]);
    const prog = Math.min(1, lt / dur);
    const fade = 0.5;

    let alpha = 1;
    if (p.transitions !== false) {
      if (lt < fade && i > 0) alpha = lt / fade;
      else if (lt < fade && i === 0) alpha = Math.min(1, lt / 0.4);
    }

    // مشهد سابق أثناء الانتقال
    if (alpha < 1 && i > 0) this._drawScene(i - 1, 1, 1);
    this._drawScene(i, prog, alpha);

    // التلاشي الأخير
    if (i === p.scenes.length - 1 && dur - lt < 0.6) {
      ctx.fillStyle = `rgba(0,0,0,${1 - (dur - lt) / 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (p.subtitles !== false && sc.narration) this._subtitle(sc.narration);
  }

  _drawScene(i, prog, alpha) {
    const { ctx, W, H } = this;
    const sc = this.p.scenes[i];
    const v = this.vids[i];
    const im = this.imgs[i];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (v && v.readyState >= 2) {
      drawCover(ctx, v, v.videoWidth, v.videoHeight, W, H, 1, 0, 0);
    } else if (im) {
      const cam = sc.camera || 'zoom-in';
      let s = 1.0;
      let ox = 0;
      const e = prog; // خطي
      if (cam === 'zoom-in') s = 1.0 + 0.14 * e;
      else if (cam === 'zoom-out') s = 1.14 - 0.14 * e;
      else if (cam === 'pan-left') {
        s = 1.14;
        ox = 0.5 - e;
      } else if (cam === 'pan-right') {
        s = 1.14;
        ox = e - 0.5;
      }
      drawCover(ctx, im, im.width, im.height, W, H, s, ox * 0.9, 0);
    } else {
      ctx.fillStyle = '#1b1d3a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9aa';
      ctx.font = `${Math.round(H / 18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد صورة', W / 2, H / 2);
    }
    ctx.restore();
  }

  _subtitle(text) {
    const { ctx, W, H } = this;
    const fs = Math.round(Math.min(W, H) * (this.p.ratio === '16:9' ? 0.05 : 0.045));
    ctx.font = `700 ${fs}px "Segoe UI", Tahoma, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    const maxW = W * 0.86;
    const lines = wrapText(ctx, text, maxW).slice(-4);
    const lh = fs * 1.35;
    const boxH = lines.length * lh + fs * 0.7;
    const y0 = H - boxH - H * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bw = Math.min(maxW + fs, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4);
    const r = fs * 0.4;
    const x0 = (W - bw) / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + bw, y0, x0 + bw, y0 + boxH, r);
    ctx.arcTo(x0 + bw, y0 + boxH, x0, y0 + boxH, r);
    ctx.arcTo(x0, y0 + boxH, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + bw, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    lines.forEach((l, k) => ctx.fillText(l, W / 2, y0 + fs * 0.35 + lh * (k + 0.5)));
    ctx.direction = 'ltr';
  }

  // مزامنة عناصر الفيديو مع الزمن
  syncVideos(time, playing) {
    const i = this.locate(Math.min(time, this.total - 0.001));
    this.vids.forEach((v, k) => {
      if (!v) return;
      if (k === i && playing) {
        if (v.paused) {
          v.currentTime = Math.max(0, time - this.starts[i]) % (v.duration || 1);
          v.play().catch(() => {});
        }
      } else if (!v.paused) v.pause();
    });
  }
}

// ---------- الصوت ----------
async function decode(ac, blob) {
  if (!blob) return null;
  try {
    return await ac.decodeAudioData(await blob.arrayBuffer());
  } catch (e) {
    return null;
  }
}

// يجدول أصوات المشاهد والموسيقى على سياق صوتي ويعيد دالة إيقاف
export async function scheduleAudio(project, ac, destination, startOffset = 0, starts) {
  const nodes = [];
  const bufs = await Promise.all(project.scenes.map((s) => decode(ac, s.audio)));
  const bgm = project.bgm ? await decode(ac, project.bgm) : null;
  const now = ac.currentTime + 0.15;
  const total = starts.total;
  project.scenes.forEach((sc, i) => {
    const b = bufs[i];
    if (!b) return;
    const st = starts.list[i] + 0.15 - startOffset;
    const src = ac.createBufferSource();
    src.buffer = b;
    const g = ac.createGain();
    g.gain.value = project.voiceVol ?? 1;
    src.connect(g).connect(destination);
    if (st >= 0) src.start(now + st);
    else if (-st < b.duration) src.start(now, -st);
    nodes.push(src);
  });
  if (bgm) {
    const src = ac.createBufferSource();
    src.buffer = bgm;
    src.loop = true;
    const g = ac.createGain();
    g.gain.value = project.bgmVol ?? 0.25;
    src.connect(g).connect(destination);
    src.start(now, startOffset % bgm.duration);
    // تلاشي الموسيقى في النهاية
    const endT = now + Math.max(0, total - startOffset);
    g.gain.setValueAtTime(g.gain.value, Math.max(now, endT - 1.5));
    g.gain.linearRampToValueAtTime(0, endT);
    nodes.push(src);
  }
  return () => nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
}

// ---------- مشغّل المعاينة ----------
export class Player {
  constructor(project, canvas, onTick) {
    this.p = project;
    this.r = new Renderer(project, canvas);
    this.onTick = onTick || (() => {});
    this.playing = false;
    this.t = 0;
    this.stopAudio = null;
    this.ac = null;
  }

  async init() {
    await this.r.load();
    this.r.draw(0);
    this.total = this.r.total;
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.total - 0.01, t));
    this.r.draw(this.t);
    this.onTick(this.t, this.total);
  }

  async play() {
    if (this.playing) return;
    if (this.t >= this.total - 0.05) this.t = 0;
    this.playing = true;
    this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
    if (this.ac.state === 'suspended') await this.ac.resume();
    this.stopAudio = await scheduleAudio(this.p, this.ac, this.ac.destination, this.t, { list: this.r.starts, total: this.total });
    const t0 = performance.now() - this.t * 1000;
    const loop = () => {
      if (!this.playing) return;
      this.t = (performance.now() - t0) / 1000;
      if (this.t >= this.total) {
        this.t = this.total - 0.01;
        this.pause();
        this.r.draw(this.t);
        this.onTick(this.total, this.total, true);
        return;
      }
      this.r.syncVideos(this.t, true);
      this.r.draw(this.t);
      this.onTick(this.t, this.total);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.stopAudio) this.stopAudio();
    this.stopAudio = null;
    this.r.syncVideos(this.t, false);
  }

  destroy() {
    this.pause();
    if (this.ac) this.ac.close().catch(() => {});
  }
}

// ---------- التصدير ----------
export function pickMime() {
  const list = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (!window.MediaRecorder) return '';
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export async function exportVideo(project, onProgress = () => {}, shouldCancel = () => false) {
  const canvas = document.createElement('canvas');
  const r = new Renderer(project, canvas);
  await r.load();
  const total = r.total;
  const fps = 30;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const stream = canvas.captureStream(fps);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = pickMime();
  if (!mime) throw new Error('المتصفح لا يدعم تسجيل الفيديو (MediaRecorder).');
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));

  const stopAudio = await scheduleAudio(project, ac, dest, 0, { list: r.starts, total });
  r.draw(0);
  rec.start(1000);
  const t0 = performance.now();
  let cancelled = false;
  await new Promise((resolve) => {
    const step = () => {
      if (shouldCancel()) {
        cancelled = true;
        return resolve();
      }
      const t = (performance.now() - t0) / 1000;
      if (t >= total) return resolve();
      r.syncVideos(t, true);
      r.draw(t);
      onProgress(t / total);
      // setTimeout بدلًا من rAF حتى لا يتوقف التصدير عند إخفاء الشاشة
      setTimeout(step, 1000 / fps);
    };
    step();
  });
  r.draw(total - 0.001);
  await new Promise((rz) => setTimeout(rz, 400));
  stopAudio();
  rec.stop();
  await done;
  r.syncVideos(0, false);
  ac.close().catch(() => {});
  if (cancelled) return null;
  const type = mime.split(';')[0];
  return new Blob(chunks, { type });
}
