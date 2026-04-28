// Data layer — local-first, Supabase-synced when authenticated.
// Each row in `tl_data` is keyed by (user_id, key) with RLS so a user
// only ever reads/writes their own rows.

import { supabase, supabaseConfigured } from './supabase.js';

const KEYS = {
  trades: 'tl_trades',
  rules: 'tl_rules',
  setups: 'tl_setups',
  settings: 'tl_settings',
  notes: 'tl_notes',
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_RULES = [
  { id: 'cat-entry', category: 'Entry Criteria', rules: [
    { id: uid(), text: 'HTF PDA aligns with bias & narrative', required: true },
    { id: uid(), text: 'IFVG confirmed on entry timeframe', required: true },
    { id: uid(), text: 'Strong DOL visible and within draw', required: true },
    { id: uid(), text: 'Internal or external range context clear', required: true },
    { id: uid(), text: 'SMT confirmation present (bonus)', required: false },
    { id: uid(), text: 'LRL respected where applicable (bonus)', required: false },
  ]},
  { id: 'cat-risk', category: 'Risk Management', rules: [
    { id: uid(), text: 'Stop loss defined before entry', required: true },
    { id: uid(), text: 'Risk per contract within plan', required: true },
    { id: uid(), text: 'Not over-exposed across accounts combined', required: true },
    { id: uid(), text: 'Max 2 trades per session respected', required: true },
  ]},
  { id: 'cat-exec', category: 'Execution', rules: [
    { id: uid(), text: 'Entry taken in correct session window', required: true },
    { id: uid(), text: 'Not trading against HTF structure', required: true },
    { id: uid(), text: 'Waited for displacement before entry', required: true },
    { id: uid(), text: 'No FOMO — model presented itself cleanly', required: true },
  ]},
  { id: 'cat-exit', category: 'Exit & Review', rules: [
    { id: uid(), text: 'Profit target set at DOL before entry', required: true },
    { id: uid(), text: 'No early exit without structural reason', required: true },
    { id: uid(), text: 'Trade journalled with screenshot same day', required: true },
    { id: uid(), text: 'No revenge trade after a loss', required: true },
  ]},
];

const DEFAULT_NOTES = [
  {
    id: 'note-1', emoji: '📐', title: 'HTF PDA → IFVG',
    tags: ['A+', 'Primary', 'IFVG'],
    blocks: [
      { id: 'b1', type: 'h1', text: 'HTF PDA → IFVG' },
      { id: 'b2', type: 'p',  text: 'Core entry model. HTF bias confirmed via PDA array, IFVG forms on LTF, enter targeting strong external DOL.' },
      { id: 'b3', type: 'h2', text: 'Entry Steps' },
      { id: 'b4', type: 'li', text: 'Identify HTF bias — is price in premium or discount?' },
      { id: 'b5', type: 'li', text: 'Mark the HTF PDA array at current dealing range' },
      { id: 'b6', type: 'li', text: 'Wait for price to arrive and react at the array' },
      { id: 'b7', type: 'li', text: 'Drop to LTF (1m–5m) — look for IFVG + displacement' },
      { id: 'b8', type: 'li', text: 'Enter at IFVG midpoint/CE, stop beyond the array' },
      { id: 'b9', type: 'h2', text: 'Notes' },
      { id: 'b10', type: 'bq', text: 'Best during London open (3–5am NY) and NY kill zone (8:30–11am). Avoid within 5 mins of news.' },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-2', emoji: '🔄', title: 'Internal → External (4 Ways)',
    tags: ['A+', 'Liquidity'],
    blocks: [
      { id: 'c1', type: 'h1', text: 'Internal → External (4 Ways)' },
      { id: 'c2', type: 'p',  text: 'Price sweeps internal range liquidity then delivers to external. Four variations.' },
      { id: 'c3', type: 'h2', text: 'Variations' },
      { id: 'c4', type: 'li', text: 'Var 1 — Sweep internal BSL → Short to external SSL' },
      { id: 'c5', type: 'li', text: 'Var 2 — Sweep internal SSL → Long to external BSL' },
      { id: 'c6', type: 'li', text: 'Var 3 — Break internal BSL → Long continuation' },
      { id: 'c7', type: 'li', text: 'Var 4 — Break internal SSL → Short continuation' },
      { id: 'c8', type: 'bq', text: 'Sweep variations (1 & 2) are highest probability. Break vars need stronger displacement evidence.' },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-3', emoji: '⚡', title: 'SMT + IFVG',
    tags: ['A', 'SMT'],
    blocks: [
      { id: 'd1', type: 'h1', text: 'SMT + IFVG' },
      { id: 'd2', type: 'p',  text: 'SMT divergence between MNQ and MES at a key level, followed by IFVG entry. SMT is confirmation — never standalone.' },
      { id: 'd3', type: 'h2', text: 'Steps' },
      { id: 'd4', type: 'li', text: 'Identify key HTF level (old HOD/LOD, PDA array)' },
      { id: 'd5', type: 'li', text: 'Watch MNQ vs MES: one makes new extreme, other fails' },
      { id: 'd6', type: 'li', text: 'Confirm IFVG on LTF — this is the actual entry trigger' },
      { id: 'd7', type: 'bq', text: 'Never enter on SMT alone. The IFVG is the entry.' },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS = {
  theme: 'dark',
  accounts: ['MNQ Main', 'MES Hedge', 'Apex Eval'],
  defaultRisk: 150,
};

function makeSample() {
  const today = new Date();
  const samples = [];
  const models = ['IFVG', 'HTF PDA → IFVG', 'Internal → External', 'SMT + IFVG', 'OB + CE'];
  const directions = ['Long', 'Short'];
  const results = ['Win', 'Win', 'Win', 'Loss', 'BE'];

  for (let i = 14; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const result = results[Math.floor(Math.random() * results.length)];
    const risk = 150;
    const r = result === 'Win' ? +(Math.random() * 3 + 1).toFixed(2)
            : result === 'Loss' ? -(Math.random() * 1 + 0.3).toFixed(2) : 0;
    const pnl = +(r * risk).toFixed(0);
    const direction = directions[Math.floor(Math.random() * 2)];
    samples.push({
      id: uid(),
      date: d.toISOString().slice(0, 10), time: '',
      instrument: Math.random() > 0.3 ? 'MNQ' : 'MES',
      accounts: [{ name: 'MNQ Main', contracts: 1 }],
      direction, htfBias: direction === 'Long' ? 'Bullish' : 'Bearish',
      session: ['London', 'NY AM Kill Zone', 'NY AM Kill Zone'][Math.floor(Math.random() * 3)],
      entryModel: models[Math.floor(Math.random() * models.length)],
      confluences: ['HTF PDA', 'IFVG', 'Strong DOL'].slice(0, Math.floor(Math.random() * 2) + 2),
      riskDollars: risk, rMultiple: r, pnlDollars: pnl, result,
      rulesChecklist: {}, rulesScore: Math.floor(Math.random() * 30) + 70,
      review: '', lesson: '', screenshotUrl: null,
      outlook: { mnqImageUrl: null, mesImageUrl: null, notes: '' },
    });
  }
  return samples;
}

// ── Sync layer ──────────────────────────────────────────────────────────────
const listeners = new Set();
let syncStatus = supabaseConfigured ? 'idle' : 'local';
let currentUser = null;

function setStatus(s) {
  syncStatus = s;
  listeners.forEach(fn => fn(s));
}

export const Sync = {
  get status() { return syncStatus; },
  get user() { return currentUser; },
  subscribe(fn) { listeners.add(fn); fn(syncStatus); return () => listeners.delete(fn); },

  setUser(u) {
    currentUser = u;
    if (!u) setStatus(supabaseConfigured ? 'idle' : 'local');
  },

  async push(key, value) {
    if (!supabase || !currentUser) return;
    try {
      setStatus('syncing');
      const { error } = await supabase.from('tl_data').upsert(
        { user_id: currentUser.id, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
      if (error) throw error;
      setStatus('synced');
    } catch (e) {
      console.warn('push failed:', e.message);
      setStatus('error');
    }
  },

  async pull(key) {
    if (!supabase || !currentUser) return null;
    try {
      const { data, error } = await supabase
        .from('tl_data').select('value')
        .eq('user_id', currentUser.id).eq('key', key)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value ?? null;
    } catch { return null; }
  },

  async pullPrefix(prefix) {
    if (!supabase || !currentUser) return null;
    try {
      const { data, error } = await supabase
        .from('tl_data').select('key,value')
        .eq('user_id', currentUser.id).like('key', `${prefix}%`);
      if (error) throw error;
      return data || [];
    } catch (e) { console.warn('pull prefix failed:', e.message); return null; }
  },

  async deleteKey(key) {
    if (!supabase || !currentUser) return;
    try {
      await supabase.from('tl_data').delete()
        .eq('user_id', currentUser.id).eq('key', key);
    } catch (e) { console.warn('delete failed:', e.message); }
  },

  // Initial sync after login: pull remote into local, push any local-only.
  async syncAll() {
    if (!supabase || !currentUser) return;
    setStatus('syncing');
    try {
      // Trades
      const remoteTrades = await this.pullPrefix('trade_');
      if (remoteTrades) {
        const local = Store.getTrades();
        const remoteMap = Object.fromEntries(remoteTrades.map(r => [r.value.id, r.value]));
        const localMap  = Object.fromEntries(local.map(t => [t.id, t]));
        const merged = Object.values({ ...remoteMap, ...localMap });
        localStorage.setItem(KEYS.trades, JSON.stringify(merged));
        for (const t of merged) {
          if (!remoteMap[t.id]) await this.push('trade_' + t.id, t);
        }
      }
      // Notes
      const remoteNotes = await this.pullPrefix('note_');
      if (remoteNotes) {
        const local = Store.getNotes();
        const remoteMap = Object.fromEntries(remoteNotes.map(r => [r.value.id, r.value]));
        const localMap  = Object.fromEntries(local.map(n => [n.id, n]));
        const merged = Object.values({ ...remoteMap, ...localMap });
        localStorage.setItem(KEYS.notes, JSON.stringify(merged));
        for (const n of merged) {
          if (!remoteMap[n.id]) await this.push('note_' + n.id, n);
        }
      }
      // Rules
      const remoteRules = await this.pull('rules');
      if (remoteRules) localStorage.setItem(KEYS.rules, JSON.stringify(remoteRules));
      else await this.push('rules', Store.getRules());
      // Settings
      const remoteSettings = await this.pull('settings');
      if (remoteSettings) {
        const local = Store.getSettings();
        const merged = { ...remoteSettings, theme: local.theme || remoteSettings.theme };
        localStorage.setItem(KEYS.settings, JSON.stringify(merged));
      } else {
        await this.push('settings', Store.getSettings());
      }
      setStatus('synced');
    } catch (e) {
      console.warn('syncAll failed:', e.message);
      setStatus('error');
    }
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  async signIn(email, password) {
    if (!supabase) return { error: 'Supabase not configured.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { user: data.user };
  },
  async signUp(email, password) {
    if (!supabase) return { error: 'Supabase not configured.' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) return { needsConfirm: true };
    return { user: data.user };
  },
  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    currentUser = null;
  },
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  },
  onAuthChange(fn) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      currentUser = session?.user ?? null;
      fn(currentUser);
    });
    return () => subscription.unsubscribe();
  },
  async resetPassword(email) {
    if (!supabase) return { error: 'Supabase not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) return { error: error.message };
    return { ok: true };
  },
};

// ── Local Store ─────────────────────────────────────────────────────────────
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export const Store = {
  uid,

  getTrades() {
    return read(KEYS.trades, []);
  },
  loadSampleTrades() {
    const s = makeSample();
    localStorage.setItem(KEYS.trades, JSON.stringify(s));
    for (const t of s) Sync.push('trade_' + t.id, t);
    return s;
  },
  saveTrade(trade) {
    const trades = this.getTrades();
    const idx = trades.findIndex(t => t.id === trade.id);
    if (idx >= 0) trades[idx] = trade; else trades.unshift(trade);
    localStorage.setItem(KEYS.trades, JSON.stringify(trades));
    Sync.push('trade_' + trade.id, trade);
    return trades;
  },
  deleteTrade(id) {
    const trades = this.getTrades().filter(t => t.id !== id);
    localStorage.setItem(KEYS.trades, JSON.stringify(trades));
    Sync.deleteKey('trade_' + id);
    return trades;
  },
  clearLocalTrades() { localStorage.removeItem(KEYS.trades); },

  getRules() { return read(KEYS.rules, DEFAULT_RULES); },
  saveRules(rules) {
    localStorage.setItem(KEYS.rules, JSON.stringify(rules));
    Sync.push('rules', rules);
  },

  getNotes() { return read(KEYS.notes, DEFAULT_NOTES); },
  saveNote(note) {
    const notes = this.getNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    localStorage.setItem(KEYS.notes, JSON.stringify(notes));
    Sync.push('note_' + note.id, note);
    return notes;
  },
  deleteNote(id) {
    const notes = this.getNotes().filter(n => n.id !== id);
    localStorage.setItem(KEYS.notes, JSON.stringify(notes));
    Sync.deleteKey('note_' + id);
    return notes;
  },

  getSettings() {
    const r = read(KEYS.settings, null);
    return r ? { ...DEFAULT_SETTINGS, ...r } : DEFAULT_SETTINGS;
  },
  saveSettings(s) {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
    Sync.push('settings', s);
  },

  // Wipe local cache when a different user signs in, so we don't leak data.
  resetLocal() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  },

  compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },
};
