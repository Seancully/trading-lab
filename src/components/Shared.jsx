import React, { useEffect } from 'react';

// ── Icons ────────────────────────────────────────────────────────────────────
export function Icon({ name, size = 16 }) {
  const icons = {
    dashboard: <path d="M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3zM13 13h7v7h-7z" strokeWidth="1.5" stroke="currentColor" fill="none"/>,
    journal:   <path d="M4 4h16v16H4zM8 9h8M8 13h6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>,
    rules:     <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    setups:    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" strokeWidth="1.5" stroke="currentColor" fill="none"/>,
    perf:      <path d="M3 17l4-8 4 4 4-6 4 3" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    calendar:  <path d="M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>,
    plus:      <path d="M12 5v14M5 12h14" strokeWidth="2" stroke="currentColor" strokeLinecap="round"/>,
    x:         <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" stroke="currentColor" strokeLinecap="round"/>,
    sun:       <><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    moon:      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>,
    trash:     <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    edit:      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>,
    image:     <path d="M4 4h16v16H4zM4 15l4-4 3 3 3-4 6 5" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    upload:    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevron:   <path d="M9 18l6-6-6-6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevronL:  <path d="M15 18l-6-6 6-6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    save:      <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM12 17v-6M9.5 14.5l2.5 2.5 2.5-2.5" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    long:      <path d="M12 19V5M5 12l7-7 7 7" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    short:     <path d="M12 5v14M5 12l7 7 7-7" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    settings:  <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    logout:    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    search:    <><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    expand:    <path d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    shrink:    <path d="M9 3v6H3M21 9h-6V3M15 21v-6h6M3 15h6v6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    filter:       <path d="M3 5h18M6 12h12M10 19h4" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/>,
    shield:       <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    confluences:  <><circle cx="9" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="15" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display:'inline-block', flexShrink:0 }}>
      {icons[name] || null}
    </svg>
  );
}

export function Badge({ result }) {
  const cls = result === 'Win' ? 'badge-win' : result === 'Loss' ? 'badge-loss' : 'badge-be';
  return <span className={`badge ${cls}`}>{result}</span>;
}

export function DirBadge({ dir }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
    fontFamily: 'var(--mono)',
    background: dir === 'Long' ? 'var(--bullDim)' : 'var(--bearDim)',
    color: dir === 'Long' ? 'var(--bull)' : 'var(--bear)',
    border: `1px solid ${dir === 'Long' ? 'rgba(34,197,94,0.25)' : 'rgba(244,63,94,0.25)'}`,
  };
  return <span style={style}><Icon name={dir === 'Long' ? 'long' : 'short'} size={11}/>{dir}</span>;
}

export function PnlText({ value, prefix = '$', size = 14 }) {
  const v = Number(value) || 0;
  const color = v > 0 ? 'var(--bull)' : v < 0 ? 'var(--bear)' : 'var(--be)';
  return (
    <span style={{ color, fontFamily: 'var(--mono)', fontSize: size, fontWeight: 600 }}>
      {v > 0 ? '+' : ''}{prefix}{v > 0 ? v.toLocaleString() : Math.abs(v).toLocaleString()}
    </span>
  );
}

export function RText({ value, size = 13 }) {
  const v = Number(value) || 0;
  const color = v > 0 ? 'var(--bull)' : v < 0 ? 'var(--bear)' : 'var(--be)';
  return (
    <span style={{ color, fontFamily: 'var(--mono)', fontSize: size, fontWeight: 600 }}>
      {v > 0 ? '+' : ''}{v}R
    </span>
  );
}

export function Modal({ title, onClose, children, maxWidth = 820, footer }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal fade-in" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Btn({ children, variant = 'ghost', size = 'md', onClick, disabled, style, type, title }) {
  return (
    <button
      type={type || 'button'}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
    >{children}</button>
  );
}

export function StatCard({ label, value, sub, color, mono = true }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-num" style={{ fontFamily: mono ? 'var(--mono)' : 'var(--font)', color: color || 'var(--text)', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t} className={`tab ${active === t ? 'active' : ''}`} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

export function FInput({ label, value, onChange, type = 'text', placeholder, min, max, step, autoFocus }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label className="form-label">{label}</label>}
      <input
        className="form-input"
        type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min} max={max} step={step} autoFocus={autoFocus}
      />
    </div>
  );
}

export function FSelect({ label, value, onChange, options }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label className="form-label">{label}</label>}
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );
}

export function FTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label className="form-label">{label}</label>}
      <textarea
        className="form-textarea"
        value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ minHeight: rows * 22 + 16 }}
      />
    </div>
  );
}

export function Sep({ label }) {
  return <div className="section-sep"><span>{label}</span></div>;
}

export function Empty({ icon = '📋', title, desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Chip({ label, accent }) {
  return (
    <span className="chip" style={accent ? { color: 'var(--accent)', borderColor: 'var(--accentBorder)', background: 'var(--accentDim)' } : {}}>
      {label}
    </span>
  );
}

export function Confirm({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm" onClose={onCancel} maxWidth={380}
      footer={<>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>Delete</Btn>
      </>}
    >
      <p style={{ color: 'var(--text2)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
