import { uid, esc, blobURL, saveBlob, pickFile, shrinkImage, rand, sleep } from './util.js';
import { db } from './db.js';
import { STYLES, CAMERAS, VOICES, LANGS, RATIO_LIST, TEMPLATES } from './styles.js';
import * as AI from './ai.js';
import { Player, exportVideo, sceneDuration, totalDuration } from './render.js';

const $ = (s) => document.querySelector(s);
const view = $('#view');
const S = { view: 'home', proj: null, list: [], draft: null, cancel: false, player: null };

// ---------- أدوات الواجهة ----------
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), err ? 6000 : 2600);
}

function busy(title, on = true) {
  $('#busy').hidden = !on;
  if (on) {
    S.cancel = false;
    $('#busyTitle').textContent = title;
    $('#busyBar').style.width = '0%';
    $('#busyNote').textContent = '';
  }
}
const prog = (p, note) => {
  $('#busyBar').style.width = Math.round(p * 100) + '%';
  if (note !== undefined) $('#busyNote').textContent = note;
};
$('#busyCancel').onclick = () => {
  S.cancel = true;
  $('#busyNote').textContent = 'جارٍ الإيقاف…';
};

let saveT;
function save() {
  if (!S.proj) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => db.put(S.proj).catch(() => toast('تعذّر حفظ المشروع (الذاكرة ممتلئة؟)', true)), 400);
}

function guard(fn) {
  return async (...a) => {
    try {
      return await fn(...a);
    } catch (e) {
      console.error(e);
      busy('', false);
      toast(e.message || 'حدث خطأ غير متوقع', true);
    }
  };
}

function styleOf(id) {
  return STYLES.find((s) => s.id === id) || STYLES[0];
}

function newProject(d) {
  return {
    id: uid(), title: d.title || 'قصة جديدة', story: d.story, style: d.style, language: d.language,
    ratio: d.ratio, voice: d.voice, seed: rand(), scenes: [], characters: [],
    subtitles: true, transitions: true, bgm: null, bgmVol: 0.25, voiceVol: 1,
  };
}

// ---------- التنقل ----------
function go(v) {
  S.view = v;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  $('#crumb').textContent = v === 'studio' && S.proj ? S.proj.title : '';
  ({ home: renderHome, create: renderCreate, studio: renderStudio, settings: renderSettings })[v]();
  window.scrollTo(0, 0);
}
$('#tabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) go(b.dataset.go);
};

// ---------- الرئيسية ----------
async function renderHome() {
  S.list = await db.all();
  view.innerHTML = `<h2>مشاريعي</h2><div class="muted">قصصك المحفوظة على هذا الجهاز.</div>
  ${S.list.length ? S.list.map((p) => {
    const first = p.scenes.find((s) => s.image);
    return `<div class="card proj" data-id="${p.id}">
      ${first ? `<img src="${blobURL(first.image)}" alt="">` : '<div class="ph"></div>'}
      <div class="grow"><div class="t">${esc(p.title)}</div>
      <div class="muted">${p.scenes.length} مشهد · ${styleOf(p.style).n}</div>
      <div class="tools"><button class="btn sm primary" data-act="open">فتح</button>
      <button class="btn sm" data-act="dup">نسخ</button>
      <button class="btn sm danger" data-act="del">حذف</button></div></div></div>`;
  }).join('') : `<div class="empty">لا توجد مشاريع بعد.<br><br><button class="btn primary" data-go2="create">ابدأ قصتك الأولى</button></div>`}`;
  view.onclick = guard(async (e) => {
    if (e.target.dataset.go2) return go(e.target.dataset.go2);
    const card = e.target.closest('.proj');
    const act = e.target.dataset.act;
    if (!card || !act) return;
    const p = S.list.find((x) => x.id === card.dataset.id);
    if (act === 'open') { S.proj = p; go('studio'); }
    if (act === 'dup') { await db.put({ ...p, id: uid(), title: p.title + ' (نسخة)' }); renderHome(); }
    if (act === 'del' && confirm('حذف هذا المشروع نهائيًا؟')) {
      await db.del(p.id);
      if (S.proj && S.proj.id === p.id) S.proj = null;
      renderHome();
    }
  });
}

// ---------- إنشاء قصة ----------
function renderCreate() {
  const d = (S.draft = S.draft || { story: '', style: 'cartoon3d', language: 'Arabic', ratio: '16:9', voice: 'nova', count: 8 });
  view.innerHTML = `<h2>قصة جديدة</h2><div class="muted">اكتب قصتك أو اكتب فكرة قصيرة ودع الذكاء الاصطناعي يكتبها.</div>
  <label class="f">القصة أو الفكرة</label>
  <textarea id="story" placeholder="مثال: أرنب صغير يبحث عن كنز في الغابة">${esc(d.story)}</textarea>
  <div class="row"><button class="btn amber" id="expand">اكتب لي قصة من الفكرة</button></div>
  <div class="muted">قوالب جاهزة</div>
  <div class="chips" id="tpl">${TEMPLATES.map((t, i) => `<button class="chip" data-i="${i}">${t.n}</button>`).join('')}</div>
  <h3>النمط الفني</h3>
  <div class="styles" id="styles">${STYLES.map((s) => `<button class="style ${s.id === d.style ? 'on' : ''}" data-id="${s.id}"><b>${s.e}</b>${s.n}</button>`).join('')}</div>
  <div class="grid2">
    <div><label class="f">لغة السرد</label><select id="lang">${LANGS.map((l) => `<option value="${l.id}" ${l.id === d.language ? 'selected' : ''}>${l.n}</option>`).join('')}</select></div>
    <div><label class="f">الأبعاد</label><select id="ratio">${RATIO_LIST.map((r) => `<option value="${r.id}" ${r.id === d.ratio ? 'selected' : ''}>${r.n}</option>`).join('')}</select></div>
    <div><label class="f">صوت الراوي</label><select id="voice">${VOICES.map((v) => `<option value="${v.id}" ${v.id === d.voice ? 'selected' : ''}>${v.n}</option>`).join('')}</select></div>
    <div><label class="f">عدد المشاهد</label><input id="count" type="number" min="3" max="24" value="${d.count}"></div>
  </div>
  <div class="row"><button class="btn primary grow" id="make">إنشاء اللوحة القصصية</button></div>
  <div class="muted">بعدها تولّد الصور والأصوات من الاستوديو، أو اضغط «توليد الكل».</div>`;

  const sync = () => {
    d.story = $('#story').value;
    d.language = $('#lang').value;
    d.ratio = $('#ratio').value;
    d.voice = $('#voice').value;
    d.count = Math.max(3, Math.min(24, +$('#count').value || 8));
  };
  view.querySelectorAll('textarea,select,input').forEach((el) => (el.onchange = sync));
  $('#tpl').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $('#story').value = TEMPLATES[+b.dataset.i].t;
    sync();
  };
  $('#styles').onclick = (e) => {
    const b = e.target.closest('.style');
    if (!b) return;
    d.style = b.dataset.id;
    document.querySelectorAll('.style').forEach((x) => x.classList.toggle('on', x === b));
  };
  $('#expand').onclick = guard(async () => {
    sync();
    if (!d.story.trim()) return toast('اكتب فكرة أولًا', true);
    busy('أكتب القصة…');
    prog(0.3);
    const lang = LANGS.find((l) => l.id === d.language).id;
    const story = await AI.ideaToStory(d.story, lang, d.count);
    busy('', false);
    d.story = story;
    $('#story').value = story;
    toast('تمت كتابة القصة، عدّلها كما تشاء');
  });
  $('#make').onclick = guard(async () => {
    sync();
    if (d.story.trim().length < 20) return toast('القصة قصيرة جدًا. اكتب فقرة على الأقل أو استخدم «اكتب لي قصة».', true);
    busy('أحلل القصة وأبني المشاهد…');
    prog(0.3);
    const data = await AI.makeStoryboard({ story: d.story, style: styleOf(d.style).n, language: d.language, count: d.count });
    const p = newProject({ ...d, title: data.title });
    p.characters = (data.characters || []).map((c) => ({ id: uid(), name: c.name, description: c.description, ref: null }));
    const byName = (n) => p.characters.find((c) => c.name === n);
    p.scenes = data.scenes.map((s) => ({
      id: uid(), narration: s.narration || '', prompt: s.image_prompt || '',
      chars: (s.characters || []).map((n) => byName(n)).filter(Boolean).map((c) => c.id),
      camera: CAMERAS.some((c) => c.id === s.camera) ? s.camera : 'zoom-in',
      image: null, audio: null, audioDur: 0, clip: null, manualDur: 0,
    }));
    await db.put(p);
    S.proj = p;
    busy('', false);
    go('studio');
    toast('تم إنشاء اللوحة. ولّد الصور والأصوات الآن.');
  });
}

// ---------- الاستوديو ----------
function renderStudio() {
  const p = S.proj;
  if (!p) {
    view.innerHTML = `<div class="empty">لا يوجد مشروع مفتوح.<br><br><button class="btn primary" id="a">قصة جديدة</button> <button class="btn" id="b">مشاريعي</button></div>`;
    $('#a').onclick = () => go('create');
    $('#b').onclick = () => go('home');
    return;
  }
  $('#crumb').textContent = p.title;
  const imgs = p.scenes.filter((s) => s.image).length;
  const auds = p.scenes.filter((s) => s.audio).length;
  view.innerHTML = `
  <h2>${esc(p.title)}</h2>
  <div class="muted">${p.scenes.length} مشهد · صور ${imgs}/${p.scenes.length} · أصوات ${auds}/${p.scenes.length} · المدة ${Math.round(totalDuration(p))} ثانية</div>
  <div class="row">
    <button class="btn amber" data-a="all">توليد الكل</button>
    <button class="btn primary" data-a="preview">معاينة وتصدير</button>
  </div>
  <div class="row">
    <button class="btn sm" data-a="allimg">كل الصور</button>
    <button class="btn sm" data-a="allaud">كل الأصوات</button>
    <button class="btn sm" data-a="allclip">كل مقاطع الفيديو</button>
    <button class="btn sm" data-a="addscene">+ مشهد</button>
  </div>

  <h3>الشخصيات (للحفاظ على ثبات الشكل)</h3>
  ${p.characters.map((c) => `<div class="card charrow" data-c="${c.id}">
    ${c.ref ? `<img class="av" src="${blobURL(c.ref)}" alt="">` : '<div class="av">👤</div>'}
    <div class="grow"><input type="text" data-f="cname" value="${esc(c.name)}">
    <textarea data-f="cdesc" style="min-height:58px;margin-top:6px">${esc(c.description)}</textarea>
    <div class="tools"><button class="btn sm" data-a="cref">صورة مرجعية</button>
    ${c.ref ? '<button class="btn sm" data-a="cunref">إزالة الصورة</button>' : ''}
    <button class="btn sm danger" data-a="cdel">حذف</button></div></div></div>`).join('') || '<div class="muted">لا توجد شخصيات.</div>'}
  <div class="row"><button class="btn sm" data-a="addchar">+ شخصية</button></div>

  <h3>إعدادات الفيديو</h3>
  <div class="card">
    <div class="sw"><input type="checkbox" id="optSub" ${p.subtitles ? 'checked' : ''}><label for="optSub">إظهار الترجمة</label></div>
    <div class="sw"><input type="checkbox" id="optTr" ${p.transitions ? 'checked' : ''}><label for="optTr">انتقال تلاشي بين المشاهد</label></div>
    <div class="grid2">
      <div><label class="f">النمط الفني</label><select id="optStyle">${STYLES.map((s) => `<option value="${s.id}" ${s.id === p.style ? 'selected' : ''}>${s.n}</option>`).join('')}</select></div>
      <div><label class="f">صوت الراوي</label><select id="optVoice">${VOICES.map((v) => `<option value="${v.id}" ${v.id === p.voice ? 'selected' : ''}>${v.n}</option>`).join('')}</select></div>
      <div><label class="f">الأبعاد</label><select id="optRatio">${RATIO_LIST.map((r) => `<option value="${r.id}" ${r.id === p.ratio ? 'selected' : ''}>${r.n}</option>`).join('')}</select></div>
      <div><label class="f">صوت الراوي (مستوى)</label><input type="range" id="optVV" min="0" max="1" step="0.05" value="${p.voiceVol ?? 1}"></div>
    </div>
    <label class="f">موسيقى الخلفية ${p.bgm ? '(مضافة)' : ''}</label>
    <div class="row"><button class="btn sm" data-a="bgm">${p.bgm ? 'تغيير' : 'رفع ملف صوتي'}</button>${p.bgm ? '<button class="btn sm danger" data-a="bgmdel">إزالة</button>' : ''}
    <input type="range" id="optBV" min="0" max="1" step="0.05" value="${p.bgmVol ?? 0.25}" style="flex:1"></div>
  </div>

  <h3>المشاهد</h3>
  ${p.scenes.map((s, i) => sceneHTML(p, s, i)).join('')}
  <div class="row"><button class="btn sm" data-a="addscene">+ مشهد</button></div>`;

  bindStudio();
}

function sceneHTML(p, s, i) {
  const rc = p.ratio === '9:16' ? 'r916' : p.ratio === '1:1' ? 'r11' : '';
  return `<div class="card scene" data-s="${s.id}">
    <div><div class="thumb ${rc}">${s.image ? `<img src="${blobURL(s.image)}" alt="">` : 'بلا صورة'}<span class="badge">${i + 1} · ${sceneDuration(s).toFixed(1)}ث</span></div>
    ${s.clip ? '<div class="muted">🎞️ مقطع فيديو مضاف</div>' : ''}</div>
    <div>
      <textarea data-f="narr" placeholder="نص السرد">${esc(s.narration)}</textarea>
      <details><summary>وصف الصورة والإعدادات</summary>
        <textarea data-f="prompt" placeholder="وصف المشهد بالإنجليزية">${esc(s.prompt)}</textarea>
        <label class="f">الشخصيات في المشهد</label>
        <div class="chips">${p.characters.map((c) => `<button class="chip ${s.chars.includes(c.id) ? 'on' : ''}" data-a="tchar" data-cid="${c.id}">${esc(c.name)}</button>`).join('') || '<span class="muted">—</span>'}</div>
        <div class="grid2"><div><label class="f">حركة الكاميرا</label><select data-f="cam">${CAMERAS.map((c) => `<option value="${c.id}" ${c.id === s.camera ? 'selected' : ''}>${c.n}</option>`).join('')}</select></div>
        <div><label class="f">المدة بالثواني (0 = تلقائي)</label><input type="number" data-f="dur" min="0" max="60" step="0.5" value="${s.manualDur || 0}"></div></div>
      </details>
      <div class="tools">
        <button class="btn sm primary" data-a="img">${s.image ? 'إعادة الصورة' : 'ولّد الصورة'}</button>
        <button class="btn sm" data-a="upimg">رفع صورة</button>
        <button class="btn sm primary" data-a="aud">${s.audio ? 'إعادة الصوت' : 'ولّد الصوت'}</button>
        ${s.audio ? '<button class="btn sm" data-a="hear">استماع</button>' : ''}
        ${s.image ? '<button class="btn sm" data-a="clip">حرّك بفيديو</button>' : ''}
        ${s.image ? '<button class="btn sm" data-a="dlimg">حفظ الصورة</button>' : ''}
        <button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="down">▼</button>
        <button class="btn sm danger" data-a="del">حذف</button>
      </div></div></div>`;
}

function sceneById(id) {
  return S.proj.scenes.find((s) => s.id === id);
}

function bindStudio() {
  const p = S.proj;
  const opt = (id, fn) => { const el = $(id); if (el) el.onchange = el.oninput = () => { fn(el); save(); }; };
  opt('#optSub', (e) => (p.subtitles = e.checked));
  opt('#optTr', (e) => (p.transitions = e.checked));
  opt('#optStyle', (e) => (p.style = e.value));
  opt('#optVoice', (e) => (p.voice = e.value));
  opt('#optRatio', (e) => (p.ratio = e.value));
  opt('#optVV', (e) => (p.voiceVol = +e.value));
  opt('#optBV', (e) => (p.bgmVol = +e.value));

  view.onchange = (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const sc = e.target.closest('[data-s]');
    const ch = e.target.closest('[data-c]');
    if (sc) {
      const s = sceneById(sc.dataset.s);
      if (f === 'narr') s.narration = e.target.value;
      if (f === 'prompt') s.prompt = e.target.value;
      if (f === 'cam') s.camera = e.target.value;
      if (f === 'dur') { s.manualDur = Math.max(0, +e.target.value || 0); }
    }
    if (ch) {
      const c = p.characters.find((x) => x.id === ch.dataset.c);
      if (f === 'cname') c.name = e.target.value;
      if (f === 'cdesc') c.description = e.target.value;
    }
    save();
  };

  view.onclick = guard(async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    const sc = b.closest('[data-s]');
    const ch = b.closest('[data-c]');
    const s = sc && sceneById(sc.dataset.s);
    const c = ch && p.characters.find((x) => x.id === ch.dataset.c);
    const keepScroll = async (fn) => { const y = window.scrollY; await fn(); renderStudio(); window.scrollTo(0, y); };

    if (a === 'all') return genAll();
    if (a === 'allimg') return genImages(p.scenes.filter((x) => !x.image || e.shiftKey));
    if (a === 'allaud') return genAudios(p.scenes.filter((x) => !x.audio));
    if (a === 'allclip') return genClips(p.scenes.filter((x) => x.image && !x.clip));
    if (a === 'preview') return openPlayer();
    if (a === 'addscene') { p.scenes.push({ id: uid(), narration: '', prompt: '', chars: [], camera: 'zoom-in', image: null, audio: null, audioDur: 0, clip: null, manualDur: 0 }); save(); return renderStudio(); }
    if (a === 'addchar') { p.characters.push({ id: uid(), name: 'شخصية جديدة', description: '', ref: null }); save(); return renderStudio(); }
    if (a === 'bgm') {
      const f = await pickFile('audio/*');
      if (f) { p.bgm = f; save(); renderStudio(); }
      return;
    }
    if (a === 'bgmdel') { p.bgm = null; save(); return renderStudio(); }
    if (c) {
      if (a === 'cref') { const f = await pickFile('image/*'); if (f) { c.ref = await shrinkImage(f, 768); save(); renderStudio(); } }
      if (a === 'cunref') { c.ref = null; save(); renderStudio(); }
      if (a === 'cdel') {
        p.characters = p.characters.filter((x) => x !== c);
        p.scenes.forEach((x) => (x.chars = x.chars.filter((id) => id !== c.id)));
        save(); renderStudio();
      }
      return;
    }
    if (!s) return;
    if (a === 'tchar') {
      const id = b.dataset.cid;
      s.chars = s.chars.includes(id) ? s.chars.filter((x) => x !== id) : [...s.chars, id];
      b.classList.toggle('on');
      return save();
    }
    if (a === 'img') { await genImages([s]); return; }
    if (a === 'aud') { await genAudios([s]); return; }
    if (a === 'clip') { await genClips([s]); return; }
    if (a === 'upimg') { const f = await pickFile('image/*'); if (f) { s.image = await shrinkImage(f, 1536); s.clip = null; save(); renderStudio(); } return; }
    if (a === 'dlimg') { await saveBlob(s.image, `${p.title}_${p.scenes.indexOf(s) + 1}`); return; }
    if (a === 'hear') { new Audio(blobURL(s.audio)).play(); return; }
    if (a === 'del') { if (confirm('حذف هذا المشهد؟')) { p.scenes = p.scenes.filter((x) => x !== s); save(); renderStudio(); } return; }
    if (a === 'up' || a === 'down') {
      const i = p.scenes.indexOf(s);
      const j = a === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= p.scenes.length) return;
      [p.scenes[i], p.scenes[j]] = [p.scenes[j], p.scenes[i]];
      save();
      return keepScroll(async () => {});
    }
  });
}

// ---------- التوليد ----------
async function audioDuration(blob) {
  const viaEl = await new Promise((res) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => res(0);
    a.src = blobURL(blob);
  });
  if (viaEl) return viaEl;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ac.decodeAudioData(await blob.arrayBuffer());
    ac.close();
    return buf.duration;
  } catch (e) {
    return 0;
  }
}

async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !S.cancel) {
      const k = i++;
      await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

async function genImages(list) {
  const p = S.proj;
  if (!list.length) return toast('كل المشاهد لديها صور');
  busy('أرسم المشاهد…');
  const st = styleOf(p.style).p;
  const gemini = AI.settings.image.provider === 'gemini';
  let done = 0, failed = 0, lastErr = '';
  await pool(list, gemini ? 2 : 2, async (s, k) => {
    try {
      const refs = s.chars.map((id) => p.characters.find((c) => c.id === id)?.ref).filter(Boolean);
      const prompt = AI.buildScenePrompt(p, s, st);
      s.image = await AI.genImage({ prompt, ratio: p.ratio, seed: p.seed + p.scenes.indexOf(s), refs });
      s.clip = null;
      await db.put(p);
    } catch (e) {
      failed++;
      lastErr = e.message;
      if (e.fatal) S.cancel = true;
    }
    prog(++done / list.length, `${done} من ${list.length}`);
  });
  busy('', false);
  renderStudio();
  if (failed) toast(`تعذّر توليد ${failed} صورة: ${lastErr}`, true);
  else toast(S.cancel ? 'تم الإيقاف' : 'اكتملت الصور');
}

async function genAudios(list) {
  const p = S.proj;
  list = list.filter((s) => s.narration.trim());
  if (!list.length) return toast('كل المشاهد لديها أصوات أو لا نص فيها');
  busy('أسجّل صوت الراوي…');
  let done = 0, failed = 0, lastErr = '';
  await pool(list, 2, async (s) => {
    try {
      s.audio = await AI.genVoice(s.narration, p.voice);
      s.audioDur = await audioDuration(s.audio);
      await db.put(p);
    } catch (e) {
      failed++;
      lastErr = e.message;
      if (e.fatal) S.cancel = true;
    }
    prog(++done / list.length, `${done} من ${list.length}`);
  });
  busy('', false);
  renderStudio();
  if (failed) toast(`تعذّر توليد ${failed} صوت: ${lastErr}`, true);
  else toast('اكتملت الأصوات');
}

async function genClips(list) {
  const p = S.proj;
  if (!list.length) return toast('لا توجد مشاهد بحاجة لمقاطع');
  busy('أحوّل الصور إلى فيديو (قد يستغرق دقائق)…');
  let done = 0;
  let err = '';
  for (const s of list) {
    if (S.cancel) break;
    try {
      s.clip = await AI.genVideoClip(s.image, s.prompt, (st) => prog(done / list.length, `المشهد ${p.scenes.indexOf(s) + 1}: ${st}`));
      await db.put(p);
    } catch (e) {
      err = e.message;
      if (e.fatal) break;
    }
    prog(++done / list.length);
  }
  busy('', false);
  renderStudio();
  if (err) toast(err, true);
}

const genAll = guard(async () => {
  const p = S.proj;
  if (!p.scenes.length) return toast('لا توجد مشاهد', true);
  await genImages(p.scenes.filter((s) => !s.image));
  if (S.cancel) return;
  await genAudios(p.scenes.filter((s) => !s.audio));
});

// ---------- المعاينة والتصدير ----------
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

async function openPlayer() {
  const p = S.proj;
  if (!p.scenes.some((s) => s.image)) return toast('ولّد صورة واحدة على الأقل أولًا', true);
  $('#player').hidden = false;
  const canvas = $('#stage');
  const pl = (S.player = new Player(p, canvas, (t, total, ended) => {
    $('#pSeek').value = Math.round((t / total) * 1000);
    $('#pTime').textContent = `${fmt(t)} / ${fmt(total)}`;
    if (ended) $('#pPlay').textContent = 'تشغيل';
  }));
  await pl.init();
  $('#pTime').textContent = `0:00 / ${fmt(pl.total)}`;
  $('#pPlay').textContent = 'تشغيل';
  $('#pPlay').onclick = guard(async () => {
    if (pl.playing) { pl.pause(); $('#pPlay').textContent = 'تشغيل'; }
    else { await pl.play(); $('#pPlay').textContent = 'إيقاف'; }
  });
  $('#pSeek').oninput = (e) => {
    const was = pl.playing;
    pl.pause();
    pl.seek((e.target.value / 1000) * pl.total);
    if (was) pl.play();
  };
  $('#pClose').onclick = closePlayer;
  $('#pExport').onclick = guard(async () => {
    pl.pause();
    $('#pPlay').textContent = 'تشغيل';
    $('#player').hidden = true;
    busy('أصدّر الفيديو… ابقَ على هذه الشاشة');
    const blob = await exportVideo(p, (x) => prog(x, `${Math.round(x * 100)}%`), () => S.cancel);
    busy('', false);
    if (!blob) return toast('تم إلغاء التصدير');
    const name = await saveBlob(blob, p.title);
    toast('تم حفظ الفيديو: ' + name);
    closePlayer();
  });
}

function closePlayer() {
  if (S.player) { S.player.destroy(); S.player = null; }
  $('#player').hidden = true;
}

// ---------- الإعدادات ----------
function renderSettings() {
  const s = AI.settings;
  const k = s.keys;
  const sel = (id, val, opts) => `<select id="${id}">${opts.map(([v, n]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  view.innerHTML = `<h2>الإعدادات</h2><div class="muted">اختر مصدر الذكاء الاصطناعي لكل أداة. الخيار المجاني لا يحتاج مفتاحًا، لكنه أبطأ وأقل ثباتًا.</div>
  <h3>القصة والتحليل</h3>
  ${sel('tText', s.text.provider, [['pollinations', 'مجاني (Pollinations)'], ['gemini', 'Google Gemini (مفتاح)'], ['openai', 'OpenAI أو متوافق (مفتاح)']])}
  <h3>الصور</h3>
  ${sel('tImg', s.image.provider, [['pollinations', 'مجاني (Pollinations)'], ['gemini', 'Gemini Image (يدعم الصور المرجعية للشخصيات)'], ['openai', 'OpenAI Images (مفتاح)']])}
  <h3>الصوت</h3>
  ${sel('tTts', s.tts.provider, [['pollinations', 'مجاني (Pollinations)'], ['openai', 'OpenAI TTS (مفتاح)']])}
  <h3>الفيديو</h3>
  ${sel('tVid', s.video.provider, [['local', 'محلي: حركة كاميرا على الصور (مجاني)'], ['fal', 'fal.ai: صورة إلى فيديو حقيقي (مفتاح)']])}
  <h3>المفاتيح</h3>
  <label class="f">مفتاح Google Gemini</label><input type="password" id="kGem" value="${esc(k.gemini)}" placeholder="AIza…">
  <label class="f">OpenAI: عنوان API</label><input type="text" id="kBase" value="${esc(k.openaiBase)}">
  <label class="f">OpenAI: المفتاح</label><input type="password" id="kOai" value="${esc(k.openaiKey)}" placeholder="sk-…">
  <div class="grid2"><div><label class="f">نموذج النص</label><input type="text" id="kTM" value="${esc(k.openaiTextModel)}"></div>
  <div><label class="f">نموذج الصور</label><input type="text" id="kIM" value="${esc(k.openaiImageModel)}"></div></div>
  <label class="f">fal.ai: المفتاح</label><input type="password" id="kFal" value="${esc(k.fal)}">
  <label class="f">fal.ai: النموذج</label><input type="text" id="kFM" value="${esc(k.falModel)}">
  <div class="muted" style="margin-top:12px">المفاتيح تُحفظ على جهازك فقط ولا تُرسل إلا إلى المزوّد الذي تختاره.</div>
  <div class="row"><button class="btn primary" id="saveSet">حفظ الإعدادات</button></div>`;
  $('#saveSet').onclick = () => {
    AI.setSetting('text.provider', $('#tText').value);
    AI.setSetting('image.provider', $('#tImg').value);
    AI.setSetting('tts.provider', $('#tTts').value);
    AI.setSetting('video.provider', $('#tVid').value);
    AI.setSetting('keys.gemini', $('#kGem').value.trim());
    AI.setSetting('keys.openaiBase', $('#kBase').value.trim() || 'https://api.openai.com/v1');
    AI.setSetting('keys.openaiKey', $('#kOai').value.trim());
    AI.setSetting('keys.openaiTextModel', $('#kTM').value.trim());
    AI.setSetting('keys.openaiImageModel', $('#kIM').value.trim());
    AI.setSetting('keys.fal', $('#kFal').value.trim());
    AI.setSetting('keys.falModel', $('#kFM').value.trim());
    toast('تم حفظ الإعدادات');
  };
}

// ---------- بدء التشغيل ----------
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
});
go('home');
