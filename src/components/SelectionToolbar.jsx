import { useEffect, useRef, useState } from 'react';

// Floating toolbar that appears above any text selection inside `containerRef`.
// Uses document.execCommand for inline formatting — deprecated but still
// universally supported and the simplest path to Notion-style inline marks.
export default function SelectionToolbar({ containerRef }) {
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState({});
  const tbRef = useRef();

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container) { setPos(null); return; }
      // Only show inside the note body
      if (!container.contains(range.commonAncestorContainer)) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) { setPos(null); return; }
      setPos({ top: rect.top - 44, left: rect.left + rect.width / 2 });
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
      });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  if (!pos) return null;

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val);
    // Re-emit a selectionchange so active state refreshes
    document.dispatchEvent(new Event('selectionchange'));
  };

  const setColor = (c) => exec('foreColor', c);
  const setHighlight = (c) => exec('hiliteColor', c) || exec('backColor', c);
  const clear = () => exec('removeFormat');

  return (
    <div
      ref={tbRef}
      className="sel-toolbar"
      style={{ position: 'fixed', top: Math.max(8, pos.top), left: pos.left, transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className={`sel-btn ${active.bold ? 'on' : ''}`} onClick={() => exec('bold')} title="Bold (⌘B)"><strong>B</strong></button>
      <button className={`sel-btn ${active.italic ? 'on' : ''}`} onClick={() => exec('italic')} title="Italic (⌘I)"><em>I</em></button>
      <button className={`sel-btn ${active.underline ? 'on' : ''}`} onClick={() => exec('underline')} title="Underline (⌘U)"><span style={{ textDecoration: 'underline' }}>U</span></button>
      <button className={`sel-btn ${active.strike ? 'on' : ''}`} onClick={() => exec('strikeThrough')} title="Strike"><span style={{ textDecoration: 'line-through' }}>S</span></button>
      <span className="sel-sep"/>
      <ColorPopover label="A" title="Text color" colors={[
        { name: 'Default', v: 'inherit' },
        { name: 'Accent',  v: '#7AA2F7' },
        { name: 'Bull',    v: '#22C55E' },
        { name: 'Bear',    v: '#EF4444' },
        { name: 'Amber',   v: '#D4A574' },
        { name: 'Muted',   v: 'rgba(232,234,237,0.55)' },
      ]} onPick={setColor}/>
      <ColorPopover label="🎨" title="Highlight" colors={[
        { name: 'None',    v: 'transparent' },
        { name: 'Accent',  v: 'rgba(122,162,247,0.18)' },
        { name: 'Bull',    v: 'rgba(34,197,94,0.18)' },
        { name: 'Bear',    v: 'rgba(239,68,68,0.18)' },
        { name: 'Amber',   v: 'rgba(212,165,116,0.20)' },
      ]} onPick={setHighlight}/>
      <span className="sel-sep"/>
      <button className="sel-btn" onClick={clear} title="Clear formatting">✕</button>
    </div>
  );
}

function ColorPopover({ label, colors, onPick, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button className="sel-btn" onClick={() => setOpen(o => !o)} title={title}>{label}</button>
      {open && (
        <div className="sel-popover" onMouseDown={(e) => e.preventDefault()}>
          {colors.map(c => (
            <button key={c.name} className="sel-color-row"
              onClick={() => { onPick(c.v); setOpen(false); }}>
              <span className="sel-color-dot" style={{ background: c.v === 'transparent' || c.v === 'inherit' ? 'var(--surface3)' : c.v, border: c.v === 'transparent' || c.v === 'inherit' ? '1px dashed var(--border2)' : 'none' }}/>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
