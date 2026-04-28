import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Shared.jsx';

// Tiny fuzzy match: returns score (higher better) or -1.
function fuzzy(needle, hay) {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  if (h.includes(n)) return 100 - h.indexOf(n);
  let i = 0, score = 0;
  for (const c of h) {
    if (c === n[i]) { score += 1; i++; if (i === n.length) return score; }
  }
  return -1;
}

export default function CommandPalette({ open, onClose, items }) {
  const [query, setQuery] = useState('');
  const [sel, setSel]     = useState(0);
  const inputRef = useRef();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return items;
    return items
      .map(it => ({ it, s: Math.max(fuzzy(query, it.label), fuzzy(query, it.group || '')) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.it);
  }, [query, items]);

  useEffect(() => { setSel(0); }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter')     { e.preventDefault(); const it = filtered[sel]; if (it) { it.run(); onClose(); } }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, filtered, sel, onClose]);

  if (!open) return null;

  return (
    <div className="cp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp-card">
        <div className="cp-search">
          <Icon name="search" size={16}/>
          <input
            ref={inputRef}
            placeholder="Type a command, page, or search trades…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="cp-list">
          {filtered.length === 0 && (
            <div className="cp-empty">No matches</div>
          )}
          {filtered.map((it, i) => (
            <div
              key={it.id}
              className={`cp-item ${i === sel ? 'sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              onMouseDown={(e) => { e.preventDefault(); it.run(); onClose(); }}
            >
              {it.icon && <span className="cp-icon"><Icon name={it.icon} size={14}/></span>}
              <span className="cp-label">{it.label}</span>
              {it.group && <span className="cp-group">{it.group}</span>}
              {it.kbd && <kbd className="kbd">{it.kbd}</kbd>}
            </div>
          ))}
        </div>
        <div className="cp-foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> select</span>
          <span><kbd className="kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
