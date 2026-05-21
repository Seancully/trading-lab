import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ── Image storage ──────────────────────────────────────────────────────────
// Chart screenshots used to live as base64 dataURLs embedded in trade JSON,
// which blew through the 5MB localStorage quota fast. We now stash them in
// a public Supabase Storage bucket under {user_id}/<random>.jpg and only
// keep the public URL on the trade. Paths use random ids so they aren't
// enumerable from outside.
export const IMAGES_BUCKET = 'trade-images';

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function uploadDataUrl(dataUrl, userId) {
  if (!supabase || !userId || !dataUrl || !dataUrl.startsWith('data:')) return null;
  let blob;
  try { blob = await dataUrlToBlob(dataUrl); } catch { return null; }
  const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (error) {
    console.warn('image upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function deleteImageByUrl(imageUrl, userId) {
  if (!supabase || !userId || !imageUrl || typeof imageUrl !== 'string') return;
  const marker = `/${IMAGES_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const path = imageUrl.slice(idx + marker.length);
  if (!path.startsWith(`${userId}/`)) return;
  try { await supabase.storage.from(IMAGES_BUCKET).remove([path]); } catch { /* noop */ }
}
