import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, Sync, effectivePnl } from './lib/store.js';
import { supabaseConfigured } from './lib/supabase.js';
import { toast } from './lib/toast.js';
import {
  Icon, Btn, Modal, FInput, Badge, DirBadge, PnlText,
} from './components/Shared.jsx';
import Toaster from './components/Toaster.jsx';
import AnimatedNumber from './components/AnimatedNumber.jsx';
import Sparkline from './components/Sparkline.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Login from './pages/Login.jsx';
import Journal from './pages/Journal.jsx';
import Rules from './pages/Rules.jsx';
import Confluences from './pages/Confluences.jsx';
import Setups from './pages/Setups.jsx';
import Performance, { EquityCurve, CalendarView } from './pages/Performance.jsx';
import { calcStats } from './lib/stats.js';

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',    icon: 'dashboard' },
  { id: 'journal',     label: 'Journal',      icon: 'journal' },
  { id: 'rules',       label: 'My Rules',     icon: 'rules' },
  { id: 'confluences', label: 'Confluences',  icon: 'rules' },
  { id: 'setups',      label: 'Notes',        icon: 'setups' },
  { id: 'performance', label: 'Performance',  icon: 'perf' },
  { id: 'calendar',    label: 'Calendar',     icon: 'calendar' },
];

const PAGE_SUB = {
  dashboard:   'ICT Framework · MNQ / MES',
  journal:     'All logged trades · click to open',
  rules:       'Your trading rulebook — auto-saved',
  confluences: 'Confluences shown when logging a trade',
  setups:      'Notes, playbooks, and weekly reviews',
  performance: 'Metrics, equity curve, model breakdown',
  calendar:    'Monthly P&L · Mon–Fri view',
};

function applyAccountFilter(trades, filter) {
  if (filter == null) return trades;            // null → all
  if (Array.isArray(filter) && !filter.length) return []; // [] → none
  return trades.filter(t => t.accounts?.some(a => filter.includes(a.name)));
}

function AccountFilterPill({ accounts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  // Convention: value === null  → all accounts (no filter)
  //             value === []    → none selected (no trades)
  //             value === [...] → only those selected
  const isAll = value === null || value === undefined;
  const isNone = Array.isArray(value) && value.length === 0;
  const label = isAll
    ? 'All accounts'
    : isNone
    ? 'No accounts'
    : value.length === 1 ? value[0]
    : `${value.length} accounts`;
  const active = !isAll;

  const toggle = (acc) => {
    // When starting from "all", treat as if every account is currently in the set.
    const current = isAll ? accounts : value;
    const set = new Set(current);
    if (set.has(acc)) set.delete(acc); else set.add(acc);
    const next = [...set];
    if (next.length === accounts.length) onChange(null);
    else onChange(next);
  };

  const isSelected = (acc) => isAll || (Array.isArray(value) && value.includes(acc));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`account-filter-pill ${active ? 'active' : ''}`} onClick={() => setOpen(o => !o)} title={`Filter by account: ${label}`}>
        <span className="filter-pill-icon"><Icon name="settings" size={11}/></span>
        <span className="filter-pill-label" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
      {open && (
        <div className="account-filter-menu" role="listbox">
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 10px 4px' }}>
            Show trades from
          </div>
          {accounts.map(acc => {
            const sel = isSelected(acc);
            return (
              <button
                key={acc}
                type="button"
                className={`menu-row account-row ${sel ? 'selected' : ''}`}
                onClick={() => toggle(acc)}
              >
                <span className={`row-check ${sel ? 'on' : ''}`}>
                  {sel && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12 10 17 19 7"/>
                    </svg>
                  )}
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>{acc}</span>
              </button>
            );
          })}
          <div className="menu-foot">
            <button onClick={() => onChange(null)}>All</button>
            <button onClick={() => onChange([])}>None</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PnlChip({ value, label }) {
  const pos = value > 0, neg = value < 0;
  return (
    <div style={{
      background: pos ? 'var(--bullDim)' : neg ? 'var(--bearDim)' : 'var(--beDim)',
      border: `1px solid ${pos ? 'rgba(34,197,94,0.2)' : neg ? 'rgba(244,63,94,0.2)' : 'rgba(148,163,184,0.2)'}`,
      borderRadius: 8, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700,
        color: pos ? 'var(--bull)' : neg ? 'var(--bear)' : 'var(--be)' }}>
        {value >= 0 ? '+' : ''}${Math.abs(value).toLocaleString()}
      </div>
    </div>
  );
}

function Dashboard({ onNav, accountFilter }) {
  const allTrades = useMemo(() => Store.getTrades(), []);
  const trades = useMemo(() => applyAccountFilter(allTrades, accountFilter), [allTrades, accountFilter]);
  const stats  = useMemo(() => calcStats(trades, accountFilter), [trades, accountFilter]);
  const recent = trades.slice(0, 6);

  const today     = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStr   = weekStart.toISOString().slice(0, 10);
  const monthStr  = today.slice(0, 7);

  const todayTrades  = trades.filter(t => t.date === today);
  const weekTrades   = trades.filter(t => (t.date || '') >= weekStr);
  const monthTrades  = trades.filter(t => (t.date || '').startsWith(monthStr));

  const eff = (t) => effectivePnl(t, accountFilter);
  const todayPnl  = todayTrades.reduce((s, t) => s + eff(t), 0);
  const weekPnl   = weekTrades.reduce((s, t) => s + eff(t), 0);
  const monthPnl  = monthTrades.reduce((s, t) => s + eff(t), 0);

  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="welcome-bar">
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{greet} 👋</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {dateLabel} · {trades.length} trade{trades.length !== 1 ? 's' : ''} logged
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => onNav('performance')}><Icon name="perf" size={13}/>Performance</Btn>
          <Btn variant="primary" onClick={() => onNav('journal')}><Icon name="plus" size={13}/>Log Trade</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        <PnlChip value={todayPnl} label={`Today · ${todayTrades.length} trade${todayTrades.length !== 1 ? 's' : ''}`}/>
        <PnlChip value={weekPnl}  label={`This week · ${weekTrades.length} trade${weekTrades.length !== 1 ? 's' : ''}`}/>
        <PnlChip value={monthPnl} label={`This month · ${monthTrades.length} trade${monthTrades.length !== 1 ? 's' : ''}`}/>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Win Rate',       num: parseFloat(stats.winRate), fmt: (v) => v.toFixed(1) + '%', sub: `${stats.wins}W · ${stats.losses}L · ${stats.bes}BE` },
            { label: 'Profit Factor',  num: isFinite(parseFloat(stats.profitFactor)) ? parseFloat(stats.profitFactor) : null, raw: !isFinite(parseFloat(stats.profitFactor)) ? stats.profitFactor : null, fmt: (v) => v.toFixed(2), sub: `Gross win $${Math.round(stats.grossWin)}` },
            { label: 'Avg R Won',      num: parseFloat(stats.avgRWin), fmt: (v) => '+' + v.toFixed(2) + 'R', sub: `Avg R Lost: ${stats.avgRLoss}R`, color: 'var(--bull)' },
            { label: 'Max Drawdown',   num: Math.round(stats.maxDD), fmt: (v) => '-$' + Math.round(v).toLocaleString(), sub: `Best day +$${Math.round(stats.bestDay)}`, color: 'var(--bear)' },
            { label: 'Rules Score',    num: stats.avgRulesScore, fmt: (v) => Math.round(v) + '%',
              sub: 'Avg checklist pass',
              color: stats.avgRulesScore >= 80 ? 'var(--bull)' : stats.avgRulesScore >= 60 ? 'var(--accent)' : 'var(--bear)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              {stats.equity.length >= 2 && (
                <div className="stat-spark">
                  <Sparkline data={stats.equity.map(e => e.value)} width={60} height={20} stroke={s.color} />
                </div>
              )}
              <div className="stat-label">{s.label}</div>
              <div className="stat-num" style={{ color: s.color || 'var(--text)' }}>
                {s.raw ?? (s.num == null ? '—' : <AnimatedNumber value={s.num} format={s.fmt}/>)}
              </div>
              {s.sub && <div className="stat-sub">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)', gap: 16 }} className="dashboard-bottom">
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>Equity Curve</div>
            <button onClick={() => onNav('performance')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Full view →</button>
          </div>
          <div style={{ height: 200 }}>
            {stats && stats.equity.length >= 2
              ? <EquityCurve equity={stats.equity}/>
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Log trades to see equity curve</div>
            }
          </div>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>Recent Trades</div>
            <button onClick={() => onNav('journal')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>All →</button>
          </div>
          {recent.length === 0
            ? <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>No trades yet</div>
            : recent.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0',
                borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <DirBadge dir={t.direction}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.entryModel}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{t.date} · {t.instrument}</div>
                </div>
                <Badge result={t.result}/>
                <PnlText value={eff(t)} size={13}/>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onSave, onClose }) {
  const [s, setS] = useState({ ...settings });
  const [newAcc, setNewAcc] = useState('');

  const addAcc = () => {
    if (!newAcc.trim()) return;
    setS(p => ({ ...p, accounts: [...p.accounts, newAcc.trim()] }));
    setNewAcc('');
  };

  return (
    <Modal title="Settings" onClose={onClose} maxWidth={500}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { onSave(s); onClose(); toast.success('Settings saved'); }}>Save</Btn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <FInput label="Default Risk per Trade ($)" type="number" value={s.defaultRisk}
          onChange={v => setS(p => ({ ...p, defaultRisk: Number(v) }))} placeholder="150"/>

        <div>
          <div className="form-label" style={{ marginBottom: 10 }}>Accounts</div>
          {s.accounts.map((acc, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 13, padding: '7px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border2)' }}>{acc}</span>
              <button onClick={() => setS(p => ({ ...p, accounts: p.accounts.filter((_, j) => j !== i) }))}
                style={{ background: 'none', border: 'none', color: 'var(--bear)', cursor: 'pointer', display: 'flex' }}>
                <Icon name="x" size={14}/>
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="form-input" placeholder="Add account..." value={newAcc}
              onChange={e => setNewAcc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addAcc(); }}
              style={{ flex: 1 }}/>
            <Btn variant="ghost" size="sm" onClick={addAcc}><Icon name="plus" size={12}/>Add</Btn>
          </div>
        </div>

        <SampleDataRow />

        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
          {supabaseConfigured
            ? 'Cross-device sync is active when signed in. Your data is private to your account.'
            : 'Supabase isn\'t configured for this build — data stays on this device only.'}
        </div>
      </div>
    </Modal>
  );
}

function SampleDataRow() {
  const [count, setCount] = useState(() => Store.countSampleTrades());
  const [busy, setBusy] = useState(false);

  const handleRemove = async () => {
    if (!count) return;
    if (!window.confirm(`Remove ${count} sample trade${count === 1 ? '' : 's'}? Your real logged trades stay.`)) return;
    setBusy(true);
    const { removed } = await Store.removeSampleTrades();
    setBusy(false);
    setCount(Store.countSampleTrades());
    toast.success(`${removed} sample trade${removed === 1 ? '' : 's'} removed`);
  };

  if (!count) return null;
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border2)',
      borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Sample data detected</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {count} trade{count === 1 ? '' : 's'} look like the seeded sample data. Remove them — your real trades stay.
        </div>
      </div>
      <Btn variant="danger" size="sm" onClick={handleRemove} disabled={busy}>
        {busy ? 'Removing…' : `Remove ${count}`}
      </Btn>
    </div>
  );
}

function SyncBadge({ status, hasUser }) {
  if (!supabaseConfigured) {
    return (
      <Badge2 color="text3" label="Local" />
    );
  }
  if (!hasUser) return <Badge2 color="text3" label="Offline" />;
  if (status === 'synced')   return <Badge2 color="bull" label="Synced" />;
  if (status === 'error')    return <Badge2 color="bear" label="Sync error" />;
  if (status === 'syncing')  return <Badge2 color="accent" label="Syncing" pulse />;
  return <Badge2 color="text3" label="Idle" />;
}
function Badge2({ color, label, pulse }) {
  const map = { bull: 'var(--bull)', bear: 'var(--bear)', accent: 'var(--accent)', text3: 'var(--text3)' };
  const dimMap = { bull: 'var(--bullDim)', bear: 'var(--bearDim)', accent: 'var(--accentDim)', text3: 'var(--surface2)' };
  const borderMap = { bull: 'rgba(34,197,94,0.2)', bear: 'rgba(239,68,68,0.2)', accent: 'var(--accentBorder)', text3: 'var(--border)' };
  return (
    <div className="sync-badge" style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 20,
      background: dimMap[color], border: `1px solid ${borderMap[color]}`,
    }} title={label}>
      <div className={pulse ? 'sync-dot' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: map[color], color: map[color] }}/>
      <span className="sync-badge-text" style={{ fontSize: 10, fontWeight: 600, color: map[color], letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | login | ready
  const [user, setUser]           = useState(null);

  const [page, setPage]           = useState('dashboard');
  const [theme, setTheme]         = useState(() => Store.getSettings().theme || 'dark');
  const [showSettings, setShowSettings] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settings, setSettings]   = useState(() => Store.getSettings());
  const [rules, setRules]         = useState(() => Store.getRules());
  const [syncStatus, setSyncStatus] = useState(Sync.status);
  const [openTradeId, setOpenTradeId] = useState(null);
  const [accountFilter, setAccountFilter] = useState(() => Store.getAccountFilter());

  const handleAccountFilterChange = (next) => {
    setAccountFilter(next);
    Store.saveAccountFilter(next);
  };

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light' : '';
  }, [theme]);

  useEffect(() => {
    const unsub = Sync.subscribe(setSyncStatus);
    return unsub;
  }, []);

  // Boot: check session
  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) {
        setAuthState('ready');
        return;
      }
      const session = await Sync.getSession();
      if (session?.user) {
        Sync.setUser(session.user);
        setUser(session.user);
        setAuthState('ready');
        Sync.syncAll();
      } else {
        setAuthState('login');
      }

      Sync.onAuthChange((u) => {
        setUser(u);
        if (!u) {
          setAuthState('login');
        }
      });
    })();
  }, []);

  // ⌘K opens command palette
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      const id = e.detail?.id;
      if (!id) return;
      setPage('journal');
      setOpenTradeId(id);
    };
    window.addEventListener('tl:openTrade', fn);
    return () => window.removeEventListener('tl:openTrade', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      const next = e.detail;
      if (Array.isArray(next)) setRules(next);
    };
    window.addEventListener('tl:rulesUpdated', fn);
    return () => window.removeEventListener('tl:rulesUpdated', fn);
  }, []);

  const paletteItems = useMemo(() => [
    ...NAV.map(n => ({ id: 'nav-' + n.id, label: 'Go to ' + n.label, group: 'Navigate', icon: n.icon, run: () => setPage(n.id) })),
    { id: 'new-trade',  label: 'Log new trade',         group: 'Actions', icon: 'plus',     kbd: 'N', run: () => { setPage('journal'); setTimeout(() => window.dispatchEvent(new CustomEvent('tl:newTrade')), 50); } },
    { id: 'new-setup',  label: 'New note',              group: 'Actions', icon: 'plus',     run: () => { setPage('setups');  setTimeout(() => window.dispatchEvent(new CustomEvent('tl:newSetup')), 50); } },
    { id: 'new-review', label: 'New weekly review',     group: 'Actions', icon: 'journal',  run: () => { setPage('setups'); setTimeout(() => { const id = Store.createWeeklyReviewNote(); window.dispatchEvent(new CustomEvent('tl:openSetup', { detail: { id } })); toast.success('Weekly review created'); }, 50); } },
    { id: 'theme',      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', group: 'Actions', icon: theme === 'dark' ? 'sun' : 'moon', run: () => toggleTheme() },
    { id: 'settings',   label: 'Open settings',         group: 'Actions', icon: 'settings', run: () => setShowSettings(true) },
    ...(user ? [{ id: 'signout', label: 'Sign out',     group: 'Account', icon: 'logout',   run: () => handleSignOut() }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [theme, user]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    Store.saveSettings({ ...Store.getSettings(), theme: next });
  };

  const handleSaveSettings = (s) => {
    Store.saveSettings(s);
    setSettings(s);
  };

  const handleSignOut = async () => {
    await Sync.signOut();
    setUser(null);
    setAuthState('login');
    toast.info('Signed out');
  };

  if (authState === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wordmark)' }}>Trading Lab</div>
        <div className="spinner"/>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <>
        <Login
          onAuth={(u) => { setUser(u); setAuthState('ready'); }}
          onLocalOnly={() => { setAuthState('ready'); }}
        />
        <Toaster />
      </>
    );
  }

  return (
    <div className="app-layout">
      <nav className="topnav">
        <div className="topnav-row row-top">
          <div className="topnav-logo">
            <h1>Trading Lab</h1>
            <p>ICT · MNQ / MES</p>
          </div>
          <div className="topnav-quote" aria-hidden>Paid for patience.</div>
          <div className="topnav-actions">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Command palette"
              className="palette-trigger"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px 5px 10px', borderRadius: 7,
                border: '1px solid var(--border2)', background: 'var(--surface)',
                color: 'var(--text3)', cursor: 'pointer', fontSize: 11,
                fontFamily: 'var(--font)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <Icon name="search" size={11}/>
              <kbd className="kbd">⌘K</kbd>
            </button>
            {settings.accounts?.length > 0 && (
              <AccountFilterPill
                accounts={settings.accounts}
                value={accountFilter}
                onChange={handleAccountFilterChange}
              />
            )}
            <SyncBadge status={syncStatus} hasUser={!!user} />

            <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14}/>
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
              <Icon name="settings" size={14}/>
            </button>

            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, paddingLeft: 10, borderLeft: '1px solid var(--border)' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accentDim)', border: '1px solid var(--accentBorder)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {(user.email || '?')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="user-email">
                  {user.email}
                </span>
                <button className="icon-btn" onClick={handleSignOut} title="Sign out" style={{ width: 26, height: 26 }}>
                  <Icon name="logout" size={13}/>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="topnav-row row-bottom">
          <div className="topnav-items">
            {NAV.map(item => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <Icon name={item.icon} size={14}/>
                <span className="label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="page-header">
          <div>
            <h2>{NAV.find(n => n.id === page)?.label}</h2>
            <p>{PAGE_SUB[page]}</p>
          </div>
          {page === 'journal' && (
            <Btn variant="primary" onClick={() => window.dispatchEvent(new CustomEvent('tl:newTrade'))}>
              <Icon name="plus" size={13}/>New Trade
            </Btn>
          )}
          {page === 'setups' && (
            <Btn variant="primary" onClick={() => window.dispatchEvent(new CustomEvent('tl:newSetup'))}>
              <Icon name="plus" size={13}/>New Note
            </Btn>
          )}
        </div>

        <ErrorBoundary key={page}>
        <div className="main-content page-transition">
          {page === 'dashboard'   && <Dashboard onNav={setPage} accountFilter={accountFilter}/>}
          {page === 'journal'     && (
            <Journal
              rules={rules}
              settings={settings}
              openTradeId={openTradeId}
              onOpenHandled={() => setOpenTradeId(null)}
              accountFilter={accountFilter}
            />
          )}
          {page === 'rules'       && <Rules/>}
          {page === 'confluences' && <Confluences/>}
          {page === 'setups'      && <Setups/>}
          {page === 'performance' && <Performance accountFilter={accountFilter}/>}
          {page === 'calendar'    && (() => {
            const filtered = applyAccountFilter(Store.getTrades(), accountFilter);
            const byDay = calcStats(filtered, accountFilter)?.byDay || {};
            return (
              <div className="card">
                <CalendarView byDay={byDay} trades={filtered} accountFilter={accountFilter}/>
              </div>
            );
          })()}
        </div>
        </ErrorBoundary>
      </main>

      {showSettings && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)}/>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

      <Toaster />
    </div>
  );
}
