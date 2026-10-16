// أدوات مساعدة عامة
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = () => Math.floor(Math.random() * 1e9);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const urlCache = new WeakMap();
export function blobURL(b) {
  if (!b) return '';
  if (!urlCache.has(b)) urlCache.set(b, URL.createObjectURL(b));
  return urlCache.get(b);
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export function blobToBase64(blob) {
  return blobToDataURL(blob).then((d) => d.split(',')[1]);
}

export function base64ToBlob(b64, type = 'image/png') {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export function extFor(blob) {
  const t = (blob.type || '').toLowerCase();
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('webm')) return 'webm';
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  if (t.includes('ogg')) return 'ogg';
  return 'bin';
}

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// حفظ ملف: على الأندرويد عبر الكتابة في الذاكرة المؤقتة ثم نافذة المشاركة/الحفظ، وعلى الويب تنزيل مباشر
export async function saveBlob(blob, baseName) {
  const safe = String(baseName || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'file';
  const filename = `${safe}.${extFor(blob)}`;
  if (isNative()) {
    const FS = window.Capacitor.registerPlugin('Filesystem');
    const Share = window.Capacitor.registerPlugin('Share');
    const path = `exports/${Date.now()}_${filename}`;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const CH = 3 * 256 * 1024; // مضاعف 3 لضمان سلامة base64
    const toB64 = (u8) => {
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    for (let off = 0; off < buf.length; off += CH) {
      const data = toB64(buf.subarray(off, off + CH));
      if (off === 0) await FS.writeFile({ path, data, directory: 'CACHE', recursive: true });
      else await FS.appendFile({ path, data, directory: 'CACHE' });
    }
    const { uri } = await FS.getUri({ path, directory: 'CACHE' });
    await Share.share({ title: filename, files: [uri], dialogTitle: 'حفظ أو مشاركة' });
    return filename;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  return filename;
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '*/*';
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}

// تصغير الصور المرفوعة لتوفير الذاكرة
export async function shrinkImage(file, max = 1280) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  } catch (e) {
    return file;
  }
}
