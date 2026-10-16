// مزودو الذكاء الاصطناعي: نص، صور، صوت، فيديو
import { blobToBase64, blobToDataURL, base64ToBlob, sleep } from './util.js';
import { RATIO_LIST } from './styles.js';

export const DEFAULTS = {
  text: { provider: 'pollinations' }, // pollinations | gemini | openai
  image: { provider: 'pollinations', model: 'flux' }, // pollinations | gemini | openai
  tts: { provider: 'pollinations' }, // pollinations | openai
  video: { provider: 'local' }, // local | fal
  keys: {
    gemini: '',
    openaiBase: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiTextModel: 'gpt-4o-mini',
    openaiImageModel: 'gpt-image-1',
    openaiTtsModel: 'tts-1',
    fal: '',
    falModel: 'fal-ai/kling-video/v1.6/standard/image-to-video',
  },
};

export let settings = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem('ss_settings') || '{}');
    return {
      text: { ...DEFAULTS.text, ...(s.text || {}) },
      image: { ...DEFAULTS.image, ...(s.image || {}) },
      tts: { ...DEFAULTS.tts, ...(s.tts || {}) },
      video: { ...DEFAULTS.video, ...(s.video || {}) },
      keys: { ...DEFAULTS.keys, ...(s.keys || {}) },
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

export function saveSettings() {
  localStorage.setItem('ss_settings', JSON.stringify(settings));
}

export function setSetting(path, value) {
  const parts = path.split('.');
  let o = settings;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
  saveSettings();
}

// ---------- أدوات الشبكة ----------
async function withRetry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (e && e.fatal) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw err;
}

async function okFetch(url, opts) {
  let r;
  try {
    r = await fetch(url, opts);
  } catch (e) {
    throw new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت.');
  }
  if (!r.ok) {
    let body = '';
    try {
      body = (await r.text()).slice(0, 300);
    } catch (e) {}
    const err = new Error(`خطأ ${r.status}: ${body || r.statusText}`);
    if (r.status === 401 || r.status === 403) {
      err.fatal = true;
      err.message = `رفض الخادم الطلب (${r.status}). تأكد من المفتاح أو الصلاحيات. ${body}`;
    }
    throw err;
  }
  return r;
}

function extractJSON(txt) {
  let s = String(txt || '').trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('لم يُرجع الذكاء الاصطناعي بيانات صالحة. حاول مرة أخرى.');
  return JSON.parse(s.slice(a, b + 1));
}

// ---------- النص ----------
export async function chat(messages, { json = false } = {}) {
  const p = settings.text.provider;
  const k = settings.keys;
  if (p === 'gemini') {
    if (!k.gemini) throw fatal('أدخل مفتاح Gemini من الإعدادات.');
    const sys = messages.find((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');
    const body = {
      contents: rest.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: json ? { responseMimeType: 'application/json' } : {},
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    const r = await okFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(k.gemini)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  }
  if (p === 'openai') {
    if (!k.openaiKey) throw fatal('أدخل مفتاح API من الإعدادات.');
    const r = await okFetch(`${k.openaiBase.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.openaiKey}` },
      body: JSON.stringify({ model: k.openaiTextModel, messages, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  // مجاني: Pollinations
  const r = await okFetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

function fatal(msg) {
  const e = new Error(msg);
  e.fatal = true;
  return e;
}

export async function ideaToStory(idea, language = 'Arabic', scenesHint = 8) {
  const out = await withRetry(() =>
    chat([
      { role: 'system', content: `You are a gifted storyteller. Write an engaging short story with a clear beginning, middle and end, suitable for turning into an animated video of about ${scenesHint} scenes. Write it in ${language}. Return only the story text, no title and no commentary.` },
      { role: 'user', content: idea },
    ])
  );
  return out.trim();
}

export async function makeStoryboard({ story, style, language = 'Arabic', count = 8 }) {
  const sys = `You are a professional animation story director. Convert the user's story into a storyboard for an animated video.
Return ONLY valid JSON with this exact schema:
{"title": string, "characters": [{"name": string, "description": string}], "scenes": [{"narration": string, "image_prompt": string, "characters": [string], "camera": "zoom-in"|"zoom-out"|"pan-left"|"pan-right"|"none"}]}
Rules:
- Produce exactly ${count} scenes that cover the whole story in order.
- "narration": ${language}, 1 to 3 short natural spoken sentences per scene, suitable for a voice-over.
- "image_prompt": English, describes setting, action, mood and camera angle of the scene. Do NOT describe the appearance of characters (they are added separately). Never ask for text or letters inside the image.
- "characters": every recurring character or creature. "description": English, concrete and fixed visual attributes (age, gender, species, hair, skin or fur color, clothes with colors, distinctive features), max 40 words. Keep "name" in ${language}.
- In each scene, "characters" lists the exact names (from the characters list) that appear visibly in that scene.
- Vary the camera movement between scenes.
- Visual style that will be applied later: ${style}.`;
  const raw = await withRetry(() =>
    chat([{ role: 'system', content: sys }, { role: 'user', content: story }], { json: true })
  );
  const data = extractJSON(raw);
  if (!Array.isArray(data.scenes) || !data.scenes.length) throw new Error('لم يتم توليد مشاهد. حاول مرة أخرى.');
  return data;
}

// ---------- الصور ----------
export function sizeFor(ratio) {
  const r = RATIO_LIST.find((x) => x.id === ratio) || RATIO_LIST[0];
  return { w: r.gw, h: r.gh };
}

export async function genImage({ prompt, ratio = '16:9', seed = 1, refs = [] }) {
  const p = settings.image.provider;
  const k = settings.keys;
  const { w, h } = sizeFor(ratio);
  return withRetry(async () => {
    if (p === 'gemini') {
      if (!k.gemini) throw fatal('أدخل مفتاح Gemini من الإعدادات.');
      const parts = [];
      for (const b of refs.slice(0, 3)) {
        parts.push({ inlineData: { mimeType: b.type || 'image/png', data: await blobToBase64(b) } });
      }
      const aspect = ratio;
      parts.push({
        text: `${refs.length ? 'Use the attached reference images to keep the characters looking identical. ' : ''}Create an image with aspect ratio ${aspect}. ${prompt}`,
      });
      const r = await okFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(k.gemini)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      });
      const j = await r.json();
      const part = (j.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData || x.inline_data);
      const d = part && (part.inlineData || part.inline_data);
      if (!d) throw new Error('لم يُرجع Gemini صورة (قد يكون المحتوى مرفوضًا).');
      return base64ToBlob(d.data, d.mimeType || d.mime_type || 'image/png');
    }
    if (p === 'openai') {
      if (!k.openaiKey) throw fatal('أدخل مفتاح API من الإعدادات.');
      const size = ratio === '1:1' ? '1024x1024' : ratio === '9:16' ? '1024x1536' : '1536x1024';
      const r = await okFetch(`${k.openaiBase.replace(/\/$/, '')}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.openaiKey}` },
        body: JSON.stringify({ model: k.openaiImageModel, prompt, size, n: 1 }),
      });
      const j = await r.json();
      const it = j.data?.[0];
      if (it?.b64_json) return base64ToBlob(it.b64_json, 'image/png');
      if (it?.url) return await (await okFetch(it.url)).blob();
      throw new Error('استجابة صور غير متوقعة.');
    }
    // مجاني: Pollinations
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&model=${settings.image.model || 'flux'}&nologo=true&private=true`;
    const r = await okFetch(url);
    const b = await r.blob();
    if (!b.type.startsWith('image/')) throw new Error('لم يُرجع الخادم صورة.');
    return b;
  });
}

// ---------- الصوت ----------
export async function genVoice(text, voice = 'nova') {
  const p = settings.tts.provider;
  const k = settings.keys;
  return withRetry(async () => {
    if (p === 'openai') {
      if (!k.openaiKey) throw fatal('أدخل مفتاح API من الإعدادات.');
      const r = await okFetch(`${k.openaiBase.replace(/\/$/, '')}/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.openaiKey}` },
        body: JSON.stringify({ model: k.openaiTtsModel, voice, input: text }),
      });
      return await r.blob();
    }
    const r = await okFetch(`https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio&voice=${voice}`);
    const b = await r.blob();
    if (!(b.type.startsWith('audio/') || b.type.includes('mpeg'))) throw new Error('لم يُرجع الخادم ملفًا صوتيًا.');
    return b;
  });
}

// ---------- الفيديو (صورة إلى فيديو عبر fal.ai) ----------
export async function genVideoClip(imageBlob, prompt, onStatus = () => {}) {
  const k = settings.keys;
  if (settings.video.provider !== 'fal' || !k.fal) {
    throw fatal('فعّل مزوّد الفيديو (fal.ai) وأدخل مفتاحه من الإعدادات.');
  }
  const image_url = await blobToDataURL(imageBlob);
  const headers = { 'Content-Type': 'application/json', Authorization: `Key ${k.fal}` };
  const r = await okFetch(`https://queue.fal.run/${k.falModel}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, image_url }),
  });
  const job = await r.json();
  const statusUrl = job.status_url || `https://queue.fal.run/${k.falModel}/requests/${job.request_id}/status`;
  const resultUrl = job.response_url || `https://queue.fal.run/${k.falModel}/requests/${job.request_id}`;
  for (let i = 0; i < 120; i++) {
    await sleep(4000);
    const s = await (await okFetch(statusUrl, { headers })).json();
    onStatus(s.status);
    if (s.status === 'COMPLETED') break;
    if (s.status === 'FAILED' || s.status === 'ERROR') throw new Error('فشل توليد الفيديو من المزوّد.');
    if (i === 119) throw new Error('انتهت مهلة توليد الفيديو.');
  }
  const res = await (await okFetch(resultUrl, { headers })).json();
  const vurl = res.video?.url || res.output?.video?.url || res.data?.video?.url;
  if (!vurl) throw new Error('لم يُرجع المزوّد رابط فيديو.');
  return await (await okFetch(vurl)).blob();
}

// ---------- بناء الأوامر النصية للصور ----------
export function buildScenePrompt(project, scene, styleText) {
  const chars = (scene.chars || []).map((id) => project.characters.find((c) => c.id === id)).filter(Boolean);
  const cd = chars.length ? ` Characters: ${chars.map((c) => `${c.name} (${c.description})`).join('; ')}.` : '';
  return `${styleText}. ${scene.prompt}.${cd} Consistent character design, no text, no letters, no watermark.`;
}
