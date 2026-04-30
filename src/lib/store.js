// Data layer — local-first, Supabase-synced when authenticated.
// Each row in `tl_data` is keyed by (user_id, key) with RLS so a user
// only ever reads/writes their own rows.

import { supabase, supabaseConfigured } from './supabase.js';

const KEYS = {
  trades: 'tl_trades',
  deletedTrades: 'tl_deleted_trades',
  deletedTradeFps: 'tl_deleted_trade_fps',
  tradeOrder: 'tl_trade_order',
  rules: 'tl_rules',
  rulesVersion: 'tl_rules_version',
  confluences: 'tl_confluences',
  confluencesVersion: 'tl_confluences_version',
  setups: 'tl_setups',
  settings: 'tl_settings',
  notes: 'tl_notes',
  deletedNotes: 'tl_deleted_notes',
  accountFilter: 'tl_account_filter',
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Stable fingerprint for cross-device deletion. The same logical trade
// (same date/time/model/pnl/direction) on two devices may have different
// random ids — tombstoning by id alone won't propagate. Fingerprint matching
// fills that gap.
export function tradeFingerprint(t) {
  if (!t) return '';
  return [
    t.date || '',
    t.time || '',
    t.entryModel || '',
    Number(t.pnlDollars) || 0,
    t.direction || '',
  ].join('|');
}

// Per-trade P&L weighted by selected accounts.
// `pnlDollars` on a trade is per-contract; each account on the trade carries
// its own contract count. The effective P&L for a given filter is:
//   Σ over accounts in filter   pnlDollars × contracts
// Conventions for `accountFilter`:
//   null/undefined → all accounts on the trade (no filter)
//   []             → no accounts selected (always 0)
//   [name, ...]    → only those names contribute
export function effectivePnl(trade, accountFilter) {
  const pnl = Number(trade?.pnlDollars) || 0;
  const accounts = trade?.accounts || [];
  // Old/sample data without per-account contract info: treat pnlDollars as the trade total.
  if (!accounts.length) return accountFilter && accountFilter.length === 0 ? 0 : pnl;
  let relevant = accounts;
  if (Array.isArray(accountFilter)) {
    if (!accountFilter.length) return 0;
    relevant = accounts.filter(a => accountFilter.includes(a.name));
  }
  return relevant.reduce((sum, a) => sum + pnl * (Number(a.contracts) || 0), 0);
}

// Number of contracts for a trade under the current filter.
export function effectiveContracts(trade, accountFilter) {
  const accounts = trade?.accounts || [];
  if (!accounts.length) return 1;
  if (Array.isArray(accountFilter)) {
    if (!accountFilter.length) return 0;
    return accounts.filter(a => accountFilter.includes(a.name))
      .reduce((s, a) => s + (Number(a.contracts) || 0), 0);
  }
  return accounts.reduce((s, a) => s + (Number(a.contracts) || 0), 0);
}

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_RULES_VERSION = 2;
const DEFAULT_RULES = [
  { id: 'cat-daily', category: 'Daily Limits', rules: [
    { id: uid(), text: '1 trade per day (2 max)', required: true },
    { id: uid(), text: 'Trade window: 9:30-11:00 NY AM', required: true },
  ]},
  { id: 'cat-entry', category: 'Entry Checklist', rules: [
    { id: uid(), text: 'HTF PDA', required: true },
    { id: uid(), text: 'IFVG present on entry timeframe', required: true },
    { id: uid(), text: 'A+ DOL clear', required: true },
    { id: uid(), text: 'Stop hunt first (bonus)', required: false },
    { id: uid(), text: 'Good displacement on IFVG (bonus)', required: false },
    { id: uid(), text: 'SMT confirmation (bonus)', required: false },
    { id: uid(), text: 'LTF LRL leading to HTF DOL (bonus)', required: false },
  ]},
  { id: 'cat-avoid', category: 'Do Not Trade', rules: [
    { id: uid(), text: 'No consolidation', required: true },
    { id: uid(), text: 'ES correlation intact', required: true },
    { id: uid(), text: 'Aligns with HTF narrative', required: true },
    { id: uid(), text: 'Not against EQH/EQL/LRL', required: true },
    { id: uid(), text: 'DOL is very clear', required: true },
    { id: uid(), text: 'No low volume (tiny candles)', required: true },
    { id: uid(), text: 'Daily loss <= 2% (even evals)', required: true },
    { id: uid(), text: 'Passed account risk <= 1% (prefer 0.5-1%)', required: true },
    { id: uid(), text: 'No strong/close SMT against direction', required: true },
  ]},
];

// IDs of notes that were previously seeded into the app. They were pushed to
// Supabase on first sync, so simply removing the seed isn't enough — they'd
// keep coming back from remote. We tombstone these ids permanently so any
// stale remote rows are deleted on next sync.
const HARDCODED_NOTE_IDS = ['note-1', 'note-2', 'note-3'];

const DEFAULT_SETTINGS = {
  theme: 'dark',
  accounts: ['MNQ Main', 'MES Hedge', 'Apex Eval'],
  defaultRisk: 150,
};

// ── Default confluences ─────────────────────────────────────────────────────
const DEFAULT_CONFLUENCES_VERSION = 1;
const DEFAULT_CONFLUENCES = [
  { id: 'cnf-htf', category: 'HTF Context', items: [
    { id: uid(), text: 'HTF PDA Alignment' },
    { id: uid(), text: 'Strong DOL in Draw' },
    { id: uid(), text: 'Aligns with HTF narrative' },
  ]},
  { id: 'cnf-liq', category: 'Liquidity', items: [
    { id: uid(), text: 'Internal BSL Swept' },
    { id: uid(), text: 'Internal SSL Swept' },
    { id: uid(), text: 'External BSL Target' },
    { id: uid(), text: 'External SSL Target' },
    { id: uid(), text: 'LRL Respected' },
    { id: uid(), text: 'Inducement Visible' },
  ]},
  { id: 'cnf-entry', category: 'Entry Triggers', items: [
    { id: uid(), text: 'IFVG Present' },
    { id: uid(), text: 'Displacement Confirmed' },
    { id: uid(), text: 'OB Mitigation' },
    { id: uid(), text: 'FVG Mitigated' },
    { id: uid(), text: 'BPR Present' },
  ]},
  { id: 'cnf-conf', category: 'Confirmation', items: [
    { id: uid(), text: 'SMT Confirmed' },
    { id: uid(), text: 'ES correlation intact' },
  ]},
  { id: 'cnf-sess', category: 'Session', items: [
    { id: uid(), text: 'Session Timing Correct' },
    { id: uid(), text: 'London Open' },
    { id: uid(), text: 'NY Open Kill Zone' },
    { id: uid(), text: '2022 Opening Range' },
  ]},
];

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
      _sample: true,
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
      // ── Deletion tombstones (id + fingerprint) ───────────────────────────
      // Without these, "delete on device A → sync from device B" resurrects
      // the trade. Two layers: tombstone by id (cheap), and by fingerprint
      // (date|time|model|pnl|direction) — the fingerprint catches the case
      // where the same logical record on two devices ended up with different
      // random ids after read-time normalization.
      const readArr = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
      const remoteDeleted = await this.pull('deleted_trades');
      const remoteDeletedFps = await this.pull('deleted_trade_fps');
      const localDeletedRaw = readArr(KEYS.deletedTrades);
      const localDeletedFpsRaw = readArr(KEYS.deletedTradeFps);
      const tombstoneSet = new Set([
        ...(Array.isArray(remoteDeleted) ? remoteDeleted : []),
        ...localDeletedRaw,
      ]);
      const fpSet = new Set([
        ...(Array.isArray(remoteDeletedFps) ? remoteDeletedFps : []),
        ...localDeletedFpsRaw,
      ]);
      const tombstoneArr = [...tombstoneSet];
      const fpArr = [...fpSet];
      localStorage.setItem(KEYS.deletedTrades, JSON.stringify(tombstoneArr));
      localStorage.setItem(KEYS.deletedTradeFps, JSON.stringify(fpArr));
      if (tombstoneArr.length > (remoteDeleted?.length || 0)) {
        await this.push('deleted_trades', tombstoneArr);
      }
      if (fpArr.length > (remoteDeletedFps?.length || 0)) {
        await this.push('deleted_trade_fps', fpArr);
      }

      // Trades — drop orphans (missing id), skip tombstoned, then merge.
      const remoteTrades = await this.pullPrefix('trade_');
      if (remoteTrades) {
        // Garbage-collect remote rows that are corrupt (no id, or value with
        // no id field) — they can't be tombstoned by id and would resurrect.
        for (const r of remoteTrades) {
          if (!r.value || !r.value.id) {
            await this.deleteKey(r.key);
          }
        }
        const local = Store.getTrades();
        const remoteMap = Object.fromEntries(
          remoteTrades
            .filter(r => r.value && r.value.id
              && !tombstoneSet.has(r.value.id)
              && !fpSet.has(tradeFingerprint(r.value)))
            .map(r => [r.value.id, r.value])
        );
        const localMap = Object.fromEntries(
          local.filter(t => t.id
              && !tombstoneSet.has(t.id)
              && !fpSet.has(tradeFingerprint(t)))
            .map(t => [t.id, t])
        );
        const merged = Object.values({ ...remoteMap, ...localMap });
        localStorage.setItem(KEYS.trades, JSON.stringify(merged));
        for (const t of merged) {
          if (!remoteMap[t.id]) await this.push('trade_' + t.id, t);
        }
        // Mop up: any remote row that's tombstoned (by id or fingerprint)
        // still in remote → kill it.
        for (const r of remoteTrades) {
          if (!r.value) continue;
          const matchesId = r.value.id && tombstoneSet.has(r.value.id);
          const matchesFp = fpSet.has(tradeFingerprint(r.value));
          if (matchesId || matchesFp) {
            await this.deleteKey(r.key);
          }
        }
      }
      // Notes — tombstone-aware merge. Hardcoded seed ids are permanently
      // tombstoned so old rows stuck in Supabase get scrubbed on sync.
      const remoteDeletedNotes = await this.pull('deleted_notes');
      const localDeletedNotesRaw = readArr(KEYS.deletedNotes);
      const noteTombstoneSet = new Set([
        ...HARDCODED_NOTE_IDS,
        ...(Array.isArray(remoteDeletedNotes) ? remoteDeletedNotes : []),
        ...localDeletedNotesRaw,
      ]);
      const noteTombstoneArr = [...noteTombstoneSet];
      localStorage.setItem(KEYS.deletedNotes, JSON.stringify(noteTombstoneArr));
      if (noteTombstoneArr.length > (remoteDeletedNotes?.length || 0)) {
        await this.push('deleted_notes', noteTombstoneArr);
      }

      const remoteNotes = await this.pullPrefix('note_');
      if (remoteNotes) {
        // Garbage-collect any remote note that's tombstoned or has no id.
        for (const r of remoteNotes) {
          if (!r.value || !r.value.id || noteTombstoneSet.has(r.value.id)) {
            await this.deleteKey(r.key);
          }
        }
        const local = Store.getNotes();
        const remoteMap = Object.fromEntries(
          remoteNotes
            .filter(r => r.value && r.value.id && !noteTombstoneSet.has(r.value.id))
            .map(r => [r.value.id, r.value])
        );
        const localMap = Object.fromEntries(
          local.filter(n => n.id && !noteTombstoneSet.has(n.id)).map(n => [n.id, n])
        );
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
      // Confluences
      const remoteCnf = await this.pull('confluences');
      if (remoteCnf) localStorage.setItem(KEYS.confluences, JSON.stringify(remoteCnf));
      else await this.push('confluences', Store.getConfluences());
      // Trade order
      const remoteOrder = await this.pull('trade_order');
      if (Array.isArray(remoteOrder)) localStorage.setItem(KEYS.tradeOrder, JSON.stringify(remoteOrder));
      // Account filter
      const remoteFilter = await this.pull('account_filter');
      if (Array.isArray(remoteFilter) && remoteFilter.length) localStorage.setItem(KEYS.accountFilter, JSON.stringify(remoteFilter));
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
    // Normalize on read:
    //  1. every trade must have an id (older / corrupted records sometimes
    //     arrive without one, which silently breaks deletion because the
    //     tombstone set ends up keyed on `undefined`).
    //  2. drop husks — entries with no pnl, no R, and no result. These are
    //     accidental empty-form saves that have nothing useful to journal.
    //  3. drop anything tombstoned by id or fingerprint.
    const raw = read(KEYS.trades, []);
    const fps = this.getDeletedFingerprints?.() ?? new Set();
    const ids = this.getDeletedTradeIds?.() ?? new Set();
    let mutated = false;
    const out = [];
    for (const t of raw) {
      if (!t || typeof t !== 'object') { mutated = true; continue; }
      const pnl = Number(t.pnlDollars) || 0;
      const r = Number(t.rMultiple) || 0;
      const hasResult = t.result === 'Win' || t.result === 'Loss' || t.result === 'BE';
      const hasContent = pnl !== 0 || r !== 0 || (hasResult && t.date);
      if (!hasContent) { mutated = true; continue; } // husk
      if (ids.has(t.id) || fps.has(tradeFingerprint(t))) { mutated = true; continue; }
      if (!t.id) {
        mutated = true;
        out.push({ ...t, id: uid() });
      } else {
        out.push(t);
      }
    }
    if (mutated) localStorage.setItem(KEYS.trades, JSON.stringify(out));
    return out;
  },
  loadSampleTrades() {
    const s = makeSample();
    localStorage.setItem(KEYS.trades, JSON.stringify(s));
    for (const t of s) Sync.push('trade_' + t.id, t);
    return s;
  },

  // Heuristic: matches the exact shape produced by makeSample() for legacy
  // samples that pre-date the _sample flag. A real journal entry won't match
  // every field at once.
  isSampleTrade(t) {
    if (!t || typeof t !== 'object') return false;
    if (t._sample === true) return true;
    const sampleModels = ['IFVG', 'HTF PDA → IFVG', 'Internal → External', 'SMT + IFVG', 'OB + CE'];
    const sampleConfluences = ['HTF PDA', 'IFVG', 'Strong DOL'];
    const oneAccount = Array.isArray(t.accounts) && t.accounts.length === 1
      && t.accounts[0]?.name === 'MNQ Main' && t.accounts[0]?.contracts === 1;
    const emptyReview = (t.review ?? '') === '' && (t.lesson ?? '') === '';
    const noShot = !t.screenshotUrl;
    const flatOutlook = t.outlook && t.outlook.mnqImageUrl == null && t.outlook.mesImageUrl == null && (t.outlook.notes ?? '') === '';
    const sampleModel = sampleModels.includes(t.entryModel);
    const cnf = Array.isArray(t.confluences) ? t.confluences : [];
    const onlySampleConfluences = cnf.length > 0 && cnf.every(c => sampleConfluences.includes(c));
    return oneAccount && emptyReview && noShot && flatOutlook && sampleModel && onlySampleConfluences;
  },

  // How many of the user's trades look like samples — surface a count before
  // we delete anything.
  countSampleTrades() {
    return this.getTrades().filter(t => this.isSampleTrade(t)).length;
  },

  // Removes sample trades both from localStorage AND from Supabase, AND
  // tombstones their ids so they can't be resurrected by a stale sync from
  // another device that still has them in localStorage.
  async removeSampleTrades() {
    const all = this.getTrades();
    const samples = all.filter(t => this.isSampleTrade(t));
    if (!samples.length) return { removed: 0 };
    const keep = all.filter(t => !this.isSampleTrade(t));
    localStorage.setItem(KEYS.trades, JSON.stringify(keep));
    // Tombstone in one batch (one push instead of N) — both ids and
    // fingerprints, so other devices with stale local copies under
    // different ids still match.
    const idSet = this.getDeletedTradeIds();
    const fpSet = this.getDeletedFingerprints();
    for (const t of samples) {
      if (t.id) idSet.add(t.id);
      fpSet.add(tradeFingerprint(t));
    }
    const idArr = [...idSet];
    const fpArr = [...fpSet];
    localStorage.setItem(KEYS.deletedTrades, JSON.stringify(idArr));
    localStorage.setItem(KEYS.deletedTradeFps, JSON.stringify(fpArr));
    Sync.push('deleted_trades', idArr);
    Sync.push('deleted_trade_fps', fpArr);
    // Then remove individual remote rows.
    for (const t of samples) {
      try { await Sync.deleteKey('trade_' + t.id); } catch { /* noop */ }
    }
    return { removed: samples.length };
  },

  // Build a weekly-review note from the past 7 days of trades and save it.
  // Returns the new note's id.
  // Plain-text dump of the current week (Mon–Sun) trade-by-trade. Designed
  // to be pasted into a Claude chat alongside trade-card screenshots so
  // Claude can help draft the weekly review. Returns one big string.
  exportWeekForClaude() {
    const trades = this.getTrades();
    const now = new Date();
    const offset = (now.getDay() + 6) % 7;
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(now.getDate() - offset);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const startStr = ymd(start), endStr = ymd(end);
    const weekTrades = trades
      .filter(t => t.date && t.date >= startStr && t.date <= endStr)
      .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

    const wins = weekTrades.filter(t => t.result === 'Win').length;
    const losses = weekTrades.filter(t => t.result === 'Loss').length;
    const bes = weekTrades.filter(t => t.result === 'BE').length;
    const totalPnl = weekTrades.reduce((s, t) => s + (Number(t.pnlDollars) || 0), 0);
    const wr = weekTrades.length ? Math.round((wins / weekTrades.length) * 100) : 0;
    const fmt = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v)).toLocaleString()}`;
    const fmtR = (v) => `${v >= 0 ? '+' : ''}${Number(v || 0).toFixed(2)}R`;

    const allRules = (this.getRules() || []).flatMap(cat => cat.rules.map(r => ({ ...r, category: cat.category })));
    const ruleById = Object.fromEntries(allRules.map(r => [r.id, r]));

    const skipCounts = {};
    for (const r of allRules) skipCounts[r.id] = { rule: r, skipped: 0 };
    const scored = weekTrades.filter(t => (t.rulesScore || 0) > 0);
    for (const t of scored) {
      const checks = t.rulesChecklist || {};
      for (const r of allRules) if (!checks[r.id]) skipCounts[r.id].skipped++;
    }
    const topSkipped = Object.values(skipCounts)
      .filter(x => x.skipped > 0)
      .sort((a, b) => b.skipped - a.skipped)
      .slice(0, 5);

    const lines = [];
    lines.push(`# Trading Week Export`);
    lines.push(`Week: ${startStr} → ${endStr}`);
    lines.push(`Summary: ${weekTrades.length} trades · ${wins}W · ${losses}L · ${bes}BE · ${wr}% WR · ${fmt(totalPnl)}`);
    lines.push('');
    if (!weekTrades.length) {
      lines.push('No trades logged this week.');
    } else {
      lines.push(`## Trades`);
      weekTrades.forEach((t, i) => {
        const accounts = (t.accounts || []).map(a => `${a.name} ×${a.contracts || 1}`).join(', ') || '—';
        const checks = t.rulesChecklist || {};
        const skippedRules = allRules.filter(r => !checks[r.id]).map(r => r.text);
        lines.push('');
        lines.push(`### Trade ${i + 1} — ${t.date} ${t.time || ''} · ${t.instrument || '—'} · ${t.direction || '—'} · ${t.entryModel || '—'}`);
        lines.push(`- Result: ${t.result || '—'} · ${fmtR(t.rMultiple)} · ${fmt(Number(t.pnlDollars) || 0)} · Rules ${t.rulesScore || 0}%`);
        lines.push(`- Session: ${t.session || '—'} · HTF bias: ${t.htfBias || '—'}`);
        lines.push(`- Accounts: ${accounts}`);
        if ((t.confluences || []).length) lines.push(`- Confluences: ${t.confluences.join(', ')}`);
        if (skippedRules.length && (t.rulesScore || 0) > 0) {
          lines.push(`- Rules skipped: ${skippedRules.join('; ')}`);
        }
        if ((t.review || '').trim()) {
          lines.push(`- Review:`);
          t.review.trim().split('\n').forEach(l => lines.push(`    ${l}`));
        }
        if ((t.lesson || '').trim()) {
          lines.push(`- Lesson:`);
          t.lesson.trim().split('\n').forEach(l => lines.push(`    ${l}`));
        }
      });
    }

    if (topSkipped.length) {
      lines.push('');
      lines.push(`## Most-skipped rules this week`);
      topSkipped.forEach(({ rule, skipped: n }) => {
        lines.push(`- ${rule.category} — ${rule.text} (${n}/${scored.length})`);
      });
    }

    return lines.join('\n');
  },

  createWeeklyReviewNote() {
    const trades = this.getTrades();
    const now = new Date();
    const day = now.getDay(); // 0 Sun .. 6 Sat
    // Treat the week as Monday → Sunday containing today
    const offset = (day + 6) % 7; // days since Monday
    const start = new Date(now); start.setDate(now.getDate() - offset);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    const ymd = (d) => d.toISOString().slice(0, 10);
    const weekTrades = trades.filter(t => t.date && t.date >= ymd(start) && t.date <= ymd(end));

    const wins = weekTrades.filter(t => t.result === 'Win').length;
    const losses = weekTrades.filter(t => t.result === 'Loss').length;
    const bes = weekTrades.filter(t => t.result === 'BE').length;
    const totalPnl = weekTrades.reduce((s, t) => s + (Number(t.pnlDollars) || 0), 0);
    const winRate = weekTrades.length ? Math.round((wins / weekTrades.length) * 100) : 0;
    const byDay = {};
    for (const t of weekTrades) byDay[t.date] = (byDay[t.date] || 0) + (Number(t.pnlDollars) || 0);
    const dayVals = Object.values(byDay);
    const bestDay = dayVals.length ? Math.max(...dayVals) : 0;
    const worstDay = dayVals.length ? Math.min(...dayVals) : 0;
    const byModel = {};
    for (const t of weekTrades) {
      const m = t.entryModel || 'Other';
      byModel[m] = (byModel[m] || 0) + 1;
    }
    const topModels = Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Most-skipped rules across this week's rules-scored trades.
    const scoredTrades = weekTrades.filter(t => (t.rulesScore || 0) > 0);
    const allRules = (this.getRules() || []).flatMap(cat => cat.rules.map(r => ({ ...r, category: cat.category })));
    const skipCounts = {};
    for (const r of allRules) skipCounts[r.id] = { rule: r, skipped: 0 };
    for (const t of scoredTrades) {
      const checks = t.rulesChecklist || {};
      for (const r of allRules) {
        if (!checks[r.id]) skipCounts[r.id].skipped++;
      }
    }
    const topSkipped = Object.values(skipCounts)
      .filter(x => x.skipped > 0)
      .sort((a, b) => b.skipped - a.skipped)
      .slice(0, 5);

    const fmt = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v)).toLocaleString()}`;
    const monthName = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endName = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const blocks = [
      { id: uid(), type: 'h1',  text: `Week of ${monthName} – ${endName}` },
      { id: uid(), type: 'p',   text: `${weekTrades.length} trade${weekTrades.length === 1 ? '' : 's'} · ${wins}W · ${losses}L · ${bes}BE · ${winRate}% WR · ${fmt(totalPnl)}` },
      { id: uid(), type: 'bq',  text: 'Fill this in with Claude: hit "Copy week for Claude" on the Performance tab (or use the toast below — it\'s already on your clipboard). Paste it into a chat with Claude, attach a screenshot of each trade card from the Journal, and ask Claude to help you draft the sections below. Then refine in your own words.' },
      { id: uid(), type: 'h2',  text: 'The numbers' },
      { id: uid(), type: 'li',  text: `Total P&L: ${fmt(totalPnl)}` },
      { id: uid(), type: 'li',  text: `Best day: ${fmt(bestDay)} · Worst day: ${fmt(worstDay)}` },
      { id: uid(), type: 'li',  text: `Top models: ${topModels.length ? topModels.map(([m, c]) => `${m} (${c})`).join(', ') : '—'}` },
      { id: uid(), type: 'h2',  text: 'What worked' },
      { id: uid(), type: 'p',   text: '' },
      { id: uid(), type: 'h2',  text: 'What didn\'t' },
      { id: uid(), type: 'p',   text: '' },
      { id: uid(), type: 'h2',  text: 'Lessons' },
      { id: uid(), type: 'li',  text: '' },
      { id: uid(), type: 'li',  text: '' },
      { id: uid(), type: 'h2',  text: 'Adjustments for next week' },
      { id: uid(), type: 'li',  text: '' },
      { id: uid(), type: 'h2',  text: 'Most-skipped rules' },
      { id: uid(), type: 'p',   text: 'Fix these:' },
      ...(topSkipped.length
        ? topSkipped.map(({ rule, skipped: count }) => ({
            id: uid(), type: 'li',
            text: `${rule.category} — ${rule.text} (${count}/${scoredTrades.length})`,
          }))
        : [{ id: uid(), type: 'li', text: scoredTrades.length === 0
            ? 'No rules-scored trades this week.'
            : 'Clean week — every rule on every trade.' }]),
      { id: uid(), type: 'bq',  text: 'Did I follow my rules? Where did I deviate, and why?' },
    ];

    const note = {
      id: uid(),
      emoji: '📊',
      title: `Weekly review · ${monthName} – ${endName}`,
      tags: ['Review', 'Weekly'],
      blocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveNote(note);
    return note.id;
  },
  saveTrade(trade) {
    const trades = this.getTrades();
    const idx = trades.findIndex(t => t.id === trade.id);
    if (idx >= 0) trades[idx] = trade; else trades.unshift(trade);
    localStorage.setItem(KEYS.trades, JSON.stringify(trades));
    Sync.push('trade_' + trade.id, trade);
    return trades;
  },
  deleteTrade(idOrTrade) {
    // Accepts a trade id (string) or a full trade object. The object form
    // gives us a fingerprint to tombstone, which makes the deletion stick
    // across devices even when each one has its own id for the same record.
    const all = this.getTrades(); // normalized — every trade has an id
    let id = typeof idOrTrade === 'string' ? idOrTrade : idOrTrade?.id;
    let target = typeof idOrTrade === 'object' ? idOrTrade : null;
    if (!id && target) {
      const found = all.find(t =>
        t.date === target.date &&
        t.time === target.time &&
        t.pnlDollars === target.pnlDollars &&
        t.entryModel === target.entryModel
      );
      id = found?.id;
      target = found || target;
    } else if (id && !target) {
      target = all.find(t => t.id === id) || null;
    }
    const next = id ? all.filter(t => t.id !== id) : all;
    localStorage.setItem(KEYS.trades, JSON.stringify(next));
    const fp = target ? tradeFingerprint(target) : null;
    this._tombstoneTrade(id, fp);
    if (id) Sync.deleteKey('trade_' + id);
    return next;
  },
  clearLocalTrades() { localStorage.removeItem(KEYS.trades); },

  // ── Deletion tombstones ────────────────────────────────────────────────
  // Two layers — by id (cheap) AND by fingerprint (cross-device): when the
  // same logical trade exists on two devices with different ids, an id-only
  // tombstone misses on the second device. Fingerprint is the fallback.
  getDeletedTradeIds() {
    return new Set(read(KEYS.deletedTrades, []));
  },
  getDeletedFingerprints() {
    return new Set(read(KEYS.deletedTradeFps, []));
  },
  _tombstoneTrade(id, fingerprint) {
    if (id) {
      const set = this.getDeletedTradeIds();
      set.add(id);
      const arr = [...set];
      localStorage.setItem(KEYS.deletedTrades, JSON.stringify(arr));
      Sync.push('deleted_trades', arr);
    }
    if (fingerprint) {
      const fps = this.getDeletedFingerprints();
      fps.add(fingerprint);
      const arr = [...fps];
      localStorage.setItem(KEYS.deletedTradeFps, JSON.stringify(arr));
      Sync.push('deleted_trade_fps', arr);
    }
  },

  getRules() {
    const version = read(KEYS.rulesVersion, 0);
    const stored = read(KEYS.rules, null);
    if (!stored || version !== DEFAULT_RULES_VERSION) {
      localStorage.setItem(KEYS.rules, JSON.stringify(DEFAULT_RULES));
      localStorage.setItem(KEYS.rulesVersion, JSON.stringify(DEFAULT_RULES_VERSION));
      Sync.push('rules', DEFAULT_RULES);
      Sync.push('rules_version', DEFAULT_RULES_VERSION);
      return DEFAULT_RULES;
    }
    return stored;
  },
  saveRules(rules) {
    localStorage.setItem(KEYS.rules, JSON.stringify(rules));
    localStorage.setItem(KEYS.rulesVersion, JSON.stringify(DEFAULT_RULES_VERSION));
    Sync.push('rules', rules);
    Sync.push('rules_version', DEFAULT_RULES_VERSION);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tl:rulesUpdated', { detail: rules }));
    }
  },

  // ── Confluences (categorized list, edited from the Confluences page) ──
  getConfluences() {
    const version = read(KEYS.confluencesVersion, 0);
    const stored = read(KEYS.confluences, null);
    if (!stored || version !== DEFAULT_CONFLUENCES_VERSION) {
      localStorage.setItem(KEYS.confluences, JSON.stringify(DEFAULT_CONFLUENCES));
      localStorage.setItem(KEYS.confluencesVersion, JSON.stringify(DEFAULT_CONFLUENCES_VERSION));
      Sync.push('confluences', DEFAULT_CONFLUENCES);
      Sync.push('confluences_version', DEFAULT_CONFLUENCES_VERSION);
      return DEFAULT_CONFLUENCES;
    }
    return stored;
  },
  saveConfluences(cnf) {
    localStorage.setItem(KEYS.confluences, JSON.stringify(cnf));
    localStorage.setItem(KEYS.confluencesVersion, JSON.stringify(DEFAULT_CONFLUENCES_VERSION));
    Sync.push('confluences', cnf);
    Sync.push('confluences_version', DEFAULT_CONFLUENCES_VERSION);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tl:confluencesUpdated', { detail: cnf }));
    }
  },

  // ── Manual trade order (array of trade IDs) ──────────────────────────────
  getTradeOrder() { return read(KEYS.tradeOrder, null); },
  saveTradeOrder(order) {
    localStorage.setItem(KEYS.tradeOrder, JSON.stringify(order));
    Sync.push('trade_order', order);
  },

  // ── Account filter (array of account names; null = all) ──────────────────
  getAccountFilter() { return read(KEYS.accountFilter, null); },
  saveAccountFilter(filter) {
    if (filter && filter.length) localStorage.setItem(KEYS.accountFilter, JSON.stringify(filter));
    else localStorage.removeItem(KEYS.accountFilter);
    Sync.push('account_filter', filter || []);
  },

  getNotes() {
    const tombstones = new Set([
      ...HARDCODED_NOTE_IDS,
      ...read(KEYS.deletedNotes, []),
    ]);
    return read(KEYS.notes, []).filter(n => n && n.id && !tombstones.has(n.id));
  },
  saveNote(note) {
    const notes = read(KEYS.notes, []);
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    localStorage.setItem(KEYS.notes, JSON.stringify(notes));
    Sync.push('note_' + note.id, note);
    return this.getNotes();
  },
  deleteNote(id) {
    const notes = read(KEYS.notes, []).filter(n => n.id !== id);
    localStorage.setItem(KEYS.notes, JSON.stringify(notes));
    // Tombstone so a stale Supabase row from another device can't resurrect it.
    const tombs = new Set(read(KEYS.deletedNotes, []));
    tombs.add(id);
    const arr = [...tombs];
    localStorage.setItem(KEYS.deletedNotes, JSON.stringify(arr));
    Sync.deleteKey('note_' + id);
    Sync.push('deleted_notes', arr);
    return this.getNotes();
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
