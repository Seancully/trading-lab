import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Store } from '../lib/store.js';
import { Icon, Btn } from '../components/Shared.jsx';
import SelectionToolbar from '../components/SelectionToolbar.jsx';

const BLOCK_TYPES = [
  { type: 'p',    icon: '¶',    label: 'Text',      desc: 'Plain paragraph' },
  { type: 'h1',   icon: 'H1',   label: 'Heading 1', desc: 'Large title' },
  { type: 'h2',   icon: 'H2',   label: 'Heading 2', desc: 'Section header' },
  { type: 'h3',   icon: 'H3',   label: 'Heading 3', desc: 'Subsection' },
  { type: 'li',   icon: '•',    label: 'Bullet',    desc: 'Bullet list item' },
  { type: 'num',  icon: '1.',   label: 'Numbered',  desc: 'Numbered list' },
  { type: 'bq',   icon: '"',    label: 'Callout',   desc: 'Highlighted note' },
  { type: 'hl',   icon: 'Hi',   label: 'Highlight', desc: 'Soft highlight block' },
  { type: 'accent', icon: 'A',  label: 'Accent',    desc: 'Accent color text' },
  { type: 'success', icon: 'OK', label: 'Success',  desc: 'Green emphasis' },
  { type: 'danger', icon: '!',  label: 'Warning',   desc: 'Red emphasis' },
  { type: 'code', icon: '</>',  label: 'Code',      desc: 'Code block' },
  { type: 'hr',   icon: '—',    label: 'Divider',   desc: 'Horizontal rule' },
  { type: 'img',  icon: '🖼',   label: 'Image',     desc: 'Upload image' },
];

function newBlock(type = 'p', text = '') {
  return { id: Store.uid(), type, text };
}

// Walk the contenteditable's selection and return the caret offset within
// the element's textContent. Used to split a block at the caret on Enter.
function getCaretOffset(el) {
  if (!el) return 0;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return (el.innerText || '').length;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return (el.innerText || '').length;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function getBlockStyle(type) {
  const base = {
    width: '100%', outline: 'none', border: 'none',
    background: 'transparent', color: 'var(--text)',
    fontFamily: 'var(--font)', wordBreak: 'break-word', lineHeight: 1.65,
    display: 'block', minHeight: '1.65em',
  };
  switch (type) {
    case 'h1':   return { ...base, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, padding: '2px 0' };
    case 'h2':   return { ...base, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25, padding: '1px 0' };
    case 'h3':   return { ...base, fontSize: 16, fontWeight: 600, lineHeight: 1.3, padding: '1px 0' };
    case 'bq':   return { ...base, fontSize: 13, fontStyle: 'italic', color: 'var(--text2)', padding: '10px 14px',
      background: 'var(--surface2)', borderLeft: '3px solid var(--accent)', borderRadius: '0 6px 6px 0' };
    case 'hl':   return { ...base, fontSize: 13, background: 'var(--accentDim)', border: '1px solid var(--accentBorder)',
      padding: '6px 10px', borderRadius: 6 };
    case 'accent': return { ...base, fontSize: 14, color: 'var(--accent)', fontWeight: 600 };
    case 'success': return { ...base, fontSize: 13, background: 'var(--bullDim)', border: '1px solid rgba(34,197,94,0.25)',
      padding: '6px 10px', borderRadius: 6, color: 'var(--bull)', fontWeight: 600 };
    case 'danger': return { ...base, fontSize: 13, background: 'var(--bearDim)', border: '1px solid rgba(239,68,68,0.25)',
      padding: '6px 10px', borderRadius: 6, color: 'var(--bear)', fontWeight: 600 };
    case 'code': return { ...base, fontFamily: 'var(--mono)', fontSize: 12,
      background: 'var(--surface2)', border: '1px solid var(--border2)',
      padding: '10px 14px', borderRadius: 6, color: 'var(--accent)', whiteSpace: 'pre-wrap' };
    default:     return { ...base, fontSize: 14 };
  }
}

const Block = React.forwardRef(function Block({
  block,
  idx,
  onInput,
  onKeyDown,
  onImageUpload,
  onPasteImage,
  onRemoveBlock,
  isFocused,
  isDragOver,
  onFocus,
  onBlur,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}, ref) {
  const fileRef = useRef();
  const localRef = useRef(null);

  useImperativeHandle(ref, () => localRef.current);

  useEffect(() => {
    const el = localRef.current;
    if (!el || isFocused) return;
    const next = block.text || '';
    if (el.innerText !== next) el.innerText = next;
  }, [block.text, isFocused]);

  if (block.type === 'hr') {
    return (
      <div className={`block-row ${isFocused ? 'is-focused' : ''} ${isDragOver ? 'is-over' : ''}`}>
        <div
          className="block-handle"
          draggable
          onDragStart={(e) => onDragStart?.(e, block.id)}
          onDragOver={(e) => onDragOver?.(e, block.id)}
          onDrop={(e) => onDrop?.(e, block.id)}
          onDragEnd={(e) => onDragEnd?.(e, block.id)}
          title="Drag to reorder"
        >⋮⋮</div>
        <div style={{ padding: '8px 0', cursor: 'default', flex: 1 }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border2)' }}/>
        </div>
      </div>
    );
  }

  if (block.type === 'img') {
    return (
      <div className={`block-row ${isFocused ? 'is-focused' : ''} ${isDragOver ? 'is-over' : ''}`}>
        <div
          className="block-handle"
          draggable
          onDragStart={(e) => onDragStart?.(e, block.id)}
          onDragOver={(e) => onDragOver?.(e, block.id)}
          onDrop={(e) => onDrop?.(e, block.id)}
          title="Drag to reorder"
        >⋮⋮</div>
        <div style={{ padding: '4px 0', flex: 1 }}>
        {block.imageUrl ? (
          <div className="block-image">
            <img src={block.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}/>
            <button
              type="button"
              className="block-image-remove"
              title="Remove image"
              onClick={() => onRemoveBlock?.(block.id)}
            >
              <Icon name="trash" size={12}/>
            </button>
            <div ref={localRef} contentEditable suppressContentEditableWarning
              data-placeholder={isFocused ? 'Caption...' : ''} onInput={onInput}
              style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, outline: 'none', fontStyle: 'italic', minHeight: '1.4em' }}
              onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur}
            />
          </div>
        ) : (
          <div className="upload-area" style={{ padding: 20 }} onClick={() => fileRef.current.click()}>
            <Icon name="image" size={20}/>
            <span style={{ fontSize: 12, marginTop: 4 }}>Click to upload image</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={async e => { const f = e.target.files[0]; if (f) onImageUpload(await Store.compressImage(f)); }}/>
          </div>
        )}
        </div>
      </div>
    );
  }

  const prefix = block.type === 'li'
    ? <span style={{ color: 'var(--text3)', marginRight: 8, fontSize: 16, userSelect: 'none', flexShrink: 0, lineHeight: '1.65' }}>•</span>
    : block.type === 'num'
    ? <span style={{ color: 'var(--text3)', marginRight: 8, fontFamily: 'var(--mono)', fontSize: 12, userSelect: 'none', flexShrink: 0, lineHeight: '1.8', minWidth: 18 }}>{idx + 1}.</span>
    : null;

  const placeholder = isFocused
    ? (block.type === 'h1' ? 'Heading 1' : block.type === 'h2' ? 'Heading 2' :
      block.type === 'h3' ? 'Heading 3' : block.type === 'bq' ? 'Callout...' :
      block.type === 'code' ? 'Code...' : "Type '/' for commands")
    : '';

  const handlePaste = (e) => {
    if (!onPasteImage || block.type === 'img') return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onPasteImage(file, block.id);
          return;
        }
      }
    }
  };

  return (
    <div className={`block-row ${isFocused ? 'is-focused' : ''} ${isDragOver ? 'is-over' : ''}`}>
      <div
        className="block-handle"
        draggable
        onDragStart={(e) => onDragStart?.(e, block.id)}
        onDragOver={(e) => onDragOver?.(e, block.id)}
        onDrop={(e) => onDrop?.(e, block.id)}
        onDragEnd={(e) => onDragEnd?.(e, block.id)}
        title="Drag to reorder"
      >⋮⋮</div>
      {prefix}
      <div
        ref={localRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ ...getBlockStyle(block.type), flex: 1 }}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        onBlur={onBlur}
        onDragOver={(e) => onDragOver?.(e, block.id)}
        onDrop={(e) => onDrop?.(e, block.id)}
      />
    </div>
  );
});

function SlashMenu({ pos, query, onSelect, onClose }) {
  const [sel, setSel] = useState(0);
  const itemRefs = useRef([]);
  const filtered = BLOCK_TYPES.filter(t => {
    if (!query) return true;
    const q = query.toLowerCase();
    return t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.type.toLowerCase().includes(q);
  });

  useEffect(() => { setSel(0); }, [query]);

  useEffect(() => {
    const el = itemRefs.current[sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel, filtered.length]);

  useEffect(() => {
    if (!filtered.length) return;
    const fn = (e) => {
      if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'ArrowDown') setSel(s => (s + 1) % filtered.length);
      if (e.key === 'ArrowUp')   setSel(s => (s - 1 + filtered.length) % filtered.length);
      if (e.key === 'Enter')     { if (filtered[sel]) onSelect(filtered[sel].type); }
      if (e.key === 'Escape')    onClose();
    };
    window.addEventListener('keydown', fn, true);
    return () => window.removeEventListener('keydown', fn, true);
  }, [sel, filtered, onSelect, onClose]);

  if (!filtered.length) return null;

  const left = Math.min(pos.x, window.innerWidth - 260);
  const top = Math.max(8, Math.min(pos.y + 4, window.innerHeight - 320));

  return (
    <div className="slash-menu" style={{ position: 'fixed', top, left, zIndex: 300 }}>
      {filtered.map((t, i) => (
        <div key={t.type} ref={el => { itemRefs.current[i] = el; }} className={`slash-menu-item ${i === sel ? 'selected' : ''}`}
          onMouseEnter={() => setSel(i)}
          onMouseDown={e => { e.preventDefault(); onSelect(t.type); }}>
          <div className="slash-menu-icon">{t.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NoteEditor({ note, onSave, onDelete, onBack }) {
  const [title,  setTitle]  = useState(note.title  || '');
  const [emoji,  setEmoji]  = useState(note.emoji  || '📝');
  const [tags,   setTags]   = useState(note.tags   || []);
  const [blocks, setBlocks] = useState(
    note.blocks?.length ? note.blocks.map(b => ({ ...b })) : [newBlock('p')]
  );
  const [newTag, setNewTag] = useState('');
  const [slash,  setSlash]  = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [titleFocused, setTitleFocused] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  const blockRefs  = useRef({});
  const bodyRef    = useRef(null);
  const saveTimer  = useRef(null);
  const titleRef = useRef(null);
  const dragId = useRef(null);

  const schedSave = useCallback((t, b, tg, em) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave({ ...note, title: t, emoji: em, tags: tg, blocks: b, updatedAt: new Date().toISOString() });
    }, 700);
  }, [note, onSave]);

  useEffect(() => { schedSave(title, blocks, tags, emoji); }, [title, blocks, tags, emoji, schedSave]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  useEffect(() => {
    const el = titleRef.current;
    if (!el || titleFocused) return;
    if (el.innerText !== (title || '')) el.innerText = title || '';
  }, [title, titleFocused]);

  const focusBlock = (id, atEnd = true) => {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (!el) return;
      el.focus();
      if (atEnd) {
        const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
    }, 20);
  };

  const insertBlock = (afterIdx, type = 'p') => {
    const nb = newBlock(type);
    setBlocks(bs => {
      const next = [...bs];
      next.splice(afterIdx + 1, 0, nb);
      return next;
    });
    focusBlock(nb.id);
    return nb;
  };

  const deleteBlock = (idx) => {
    if (blocks.length <= 1) return;
    const prevId = blocks[idx - 1]?.id;
    setBlocks(bs => bs.filter((_, i) => i !== idx));
    if (prevId) focusBlock(prevId);
  };

  const removeBlockById = (id) => {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id);
      if (idx === -1) return bs;
      if (bs.length <= 1) {
        return bs.map(b => b.id === id ? { ...b, type: 'p', text: '' } : b);
      }
      const next = bs.filter((_, i) => i !== idx);
      const focusId = next[Math.max(0, idx - 1)]?.id;
      if (focusId) setTimeout(() => focusBlock(focusId), 20);
      return next;
    });
  };

  const updateBlockText = (id, text) => {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id);
      if (idx === -1) return bs;
      if ((bs[idx].text || '') === text) return bs;
      const next = [...bs];
      next[idx] = { ...next[idx], text };
      return next;
    });
  };

  const moveBlock = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setBlocks(bs => {
      const from = bs.findIndex(b => b.id === fromId);
      const to = bs.findIndex(b => b.id === toId);
      if (from === -1 || to === -1) return bs;
      const next = [...bs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const getCaretPos = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (rect && (rect.top || rect.left)) return { x: rect.left, y: rect.bottom };
    return null;
  };

  const getSlashInfo = (text) => {
    const trimmed = text.replace(/\s+$/g, '');
    const idx = trimmed.lastIndexOf('/');
    if (idx < 0) return null;
    const before = trimmed.slice(0, idx);
    if (before.trim() !== '') return null;
    return { idx, query: trimmed.slice(idx + 1) };
  };

  const openSlashAtCaret = (blockId, fallbackEl) => {
    const caret = getCaretPos();
    const rect = caret || (fallbackEl ? fallbackEl.getBoundingClientRect() : null);
    if (!rect) return;
    setSlash({ blockId, pos: { x: rect.x || rect.left, y: rect.y || rect.bottom }, query: '' });
  };

  const handleInput = (e, blockId) => {
    const text = e.currentTarget.innerText || '';
    const info = getSlashInfo(text);
    if (info) {
      const caret = getCaretPos();
      if (caret) {
        setSlash(s => ({ blockId, pos: caret, query: info.query }));
      } else if (!slash || slash.blockId !== blockId) {
        const rect = e.currentTarget.getBoundingClientRect();
        setSlash({ blockId, pos: { x: rect.left, y: rect.bottom }, query: info.query });
      } else {
        setSlash(s => ({ ...s, query: info.query }));
      }
    } else if (slash?.blockId === blockId) {
      setSlash(null);
    }
    updateBlockText(blockId, text);
  };

  const handleKeyDown = (e, block, idx) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      openSlashAtCaret(block.id, blockRefs.current[block.id]);
      return;
    }
    if (slash && ['ArrowDown','ArrowUp','Enter'].includes(e.key)) return;
    if (e.key === 'Escape' && slash) { setSlash(null); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (block.type === 'code') return;
      e.preventDefault();
      setSlash(null);
      const el = blockRefs.current[block.id];
      const currentText = el?.innerText || '';

      // Empty list item → convert to paragraph (existing behavior)
      if ((block.type === 'li' || block.type === 'num') && !currentText.trim()) {
        setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, type: 'p', text: '' } : b));
        focusBlock(block.id);
        return;
      }

      // Split at the caret: text before stays, text after moves to a new block.
      const offset = getCaretOffset(el);
      const before = currentText.slice(0, offset);
      const after  = currentText.slice(offset);
      const continueType = (block.type === 'li' || block.type === 'num') ? block.type : 'p';
      const newId = Store.uid();

      setBlocks(bs => {
        const next = [...bs];
        const i = next.findIndex(b => b.id === block.id);
        if (i < 0) return bs;
        next[i] = { ...next[i], text: before };
        next.splice(i + 1, 0, { id: newId, type: continueType, text: after });
        return next;
      });
      // Focus the new block at the start of its content
      setTimeout(() => {
        const el2 = blockRefs.current[newId];
        if (!el2) return;
        el2.focus();
        const r = document.createRange();
        r.selectNodeContents(el2);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
      }, 30);
      return;
    }

    if (e.key === 'Backspace') {
      const text = blockRefs.current[block.id]?.innerText || '';
      if (text === '') { e.preventDefault(); deleteBlock(idx); return; }
      if (text === '/' && slash) setSlash(null);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const cycle = { p: 'h1', h1: 'h2', h2: 'h3', h3: 'p' };
      if (cycle[block.type]) {
        setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, type: cycle[block.type] } : b));
      }
    }
  };

  const applySlashType = (type) => {
    if (!slash) return;
    const { blockId } = slash;
    const el = blockRefs.current[blockId];
    const newText = (el?.innerText || '').replace(/^\/\S*/, '').trimStart();

    if (type === 'hr') {
      setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, type: 'hr', text: '' } : b));
    } else if (type === 'img') {
      setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, type: 'img', text: '', imageUrl: null } : b));
    } else {
      setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, type, text: newText } : b));
      setTimeout(() => {
        const el2 = blockRefs.current[blockId];
        if (el2) { el2.innerText = newText; focusBlock(blockId); }
      }, 20);
    }
    setSlash(null);
  };

  const handleDragStart = (e, id) => {
    dragId.current = id;
    setDragOverId(null);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  };

  const handleDragOver = (e, id) => {
    if (!dragId.current || dragId.current === id) return;
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (e, id) => {
    e.preventDefault();
    const from = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    moveBlock(from, id);
  };

  const handlePasteImage = async (file, id) => {
    if (!file || !file.type.startsWith('image/')) return;
    const imageUrl = await Store.compressImage(file);
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, type: 'img', imageUrl, text: '' } : b));
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDragOverId(null);
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setNewTag('');
  };

  const lastUpdated = note.updatedAt ? new Date(note.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, fontFamily: 'var(--font)' }}>
          <Icon name="chevronL" size={13}/> Notes
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Saved {lastUpdated}</span>
        <button onClick={() => { if (window.confirm('Delete this note?')) { onDelete(note.id); onBack(); } }}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="trash" size={14}/>
        </button>
      </div>

      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '36px 52px 80px' }}
        onPaste={async (e) => {
          // 1) Image in clipboard → insert as a new img block after the focused one.
          const items = e.clipboardData?.items || [];
          for (const item of items) {
            if (item.type && item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (!file) continue;
              e.preventDefault();
              const url = await Store.compressImage(file);
              const nb = { id: Store.uid(), type: 'img', text: '', imageUrl: url };
              setBlocks(bs => {
                const idx = bs.findIndex(b => b.id === focusedId);
                const next = [...bs];
                if (idx >= 0) next.splice(idx + 1, 0, nb); else next.push(nb);
                return next;
              });
              return;
            }
          }

          // 2) Plain-text paste with multiple lines → split into blocks like Notion.
          //    Single-line text falls through to the browser so the caret stays put.
          const text = e.clipboardData?.getData('text/plain') || '';
          if (!text || !text.includes('\n')) return;
          e.preventDefault();
          const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (!lines.length) return;
          const newBlocks = lines.map(t => ({ id: Store.uid(), type: 'p', text: t }));

          setBlocks(bs => {
            const idx = bs.findIndex(b => b.id === focusedId);
            // If the focused block is empty, replace it with the first pasted line
            // and insert the rest after; otherwise insert all after the current.
            if (idx >= 0) {
              const next = [...bs];
              const cur = next[idx];
              if (!cur.text || !cur.text.trim()) {
                next[idx] = { ...cur, text: newBlocks[0].text };
                next.splice(idx + 1, 0, ...newBlocks.slice(1));
              } else {
                next.splice(idx + 1, 0, ...newBlocks);
              }
              return next;
            }
            return [...bs, ...newBlocks];
          });
          // Focus the last inserted block
          const last = newBlocks[newBlocks.length - 1];
          setTimeout(() => focusBlock(last.id), 30);
        }}
      >
        <div style={{ fontSize: 38, marginBottom: 10, cursor: 'default', userSelect: 'none', lineHeight: 1 }}>{emoji}</div>

        <div
          ref={titleRef}
          contentEditable suppressContentEditableWarning
          data-placeholder={titleFocused ? 'Untitled' : ''}
          style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.025em', outline: 'none',
            color: 'var(--text)', lineHeight: 1.2, marginBottom: 14,
            minHeight: '1.2em', display: 'block' }}
          onInput={e => setTitle(e.target.innerText || '')}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignItems: 'center' }}>
          {tags.map(tag => (
            <span key={tag} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {tag}
              <span onClick={() => setTags(t => t.filter(x => x !== tag))}
                style={{ opacity: 0.5, cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>✕</span>
            </span>
          ))}
          <input
            style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border2)',
              color: 'var(--text2)', fontSize: 11, outline: 'none', width: 70, fontFamily: 'var(--font)', padding: '1px 0' }}
            placeholder="+ tag"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            onBlur={addTag}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 }}/>

        <div style={{ maxWidth: 700 }}>
          {blocks.map((block, idx) => (
            <Block
              key={block.id}
              block={block}
              idx={idx}
              ref={el => { blockRefs.current[block.id] = el; }}
              onInput={e => handleInput(e, block.id)}
              onKeyDown={e => handleKeyDown(e, block, idx)}
              onPasteImage={handlePasteImage}
              onRemoveBlock={removeBlockById}
              onFocus={() => setFocusedId(block.id)}
              onBlur={() => setFocusedId(id => id === block.id ? null : id)}
              isFocused={focusedId === block.id}
              isDragOver={dragOverId === block.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onImageUpload={url => setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, imageUrl: url } : b))}
            />
          ))}

          <div onClick={() => {
            const nb = newBlock('p');
            setBlocks(bs => [...bs, nb]);
            focusBlock(nb.id);
          }} style={{ paddingTop: 12, paddingBottom: 40, cursor: 'text' }}>
            {(focusedId || titleFocused) && (
              <span style={{ fontSize: 13, color: 'var(--text3)', userSelect: 'none' }}>
                Click to add a block, or press&nbsp;
                <kbd style={{ padding: '1px 5px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>/</kbd>
                &nbsp;for commands
              </span>
            )}
          </div>
        </div>
      </div>

      {slash && (
        <SlashMenu pos={slash.pos} query={slash.query}
          onSelect={applySlashType} onClose={() => setSlash(null)}/>
      )}

      <SelectionToolbar containerRef={bodyRef}/>
    </div>
  );
}

function NoteListItem({ note, active, onClick }) {
  const preview = note.blocks?.find(b => b.type === 'p' && b.text)?.text?.slice(0, 55) || '';
  return (
    <div className={`note-list-item ${active ? 'active' : ''}`} onClick={onClick}>
      <h4>{note.emoji || '📝'} {note.title || 'Untitled'}</h4>
      {preview && <p>{preview}</p>}
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
        {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}
        {note.tags?.length ? ' · ' + note.tags.slice(0, 2).join(', ') : ''}
      </div>
    </div>
  );
}

export default function Setups() {
  const [notes, setNotes] = useState(() => Store.getNotes());
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  const createNote = () => {
    const note = {
      id: Store.uid(), emoji: '📝', title: '', tags: [],
      blocks: [newBlock('p')],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setNotes(Store.saveNote(note));
    setSelectedId(note.id);
  };

  useEffect(() => {
    const fn = () => createNote();
    window.addEventListener('tl:newSetup', fn);
    const open = (e) => {
      const id = e.detail?.id;
      if (!id) return;
      // Refresh notes from store so the new one is visible, then select it.
      setNotes(Store.getNotes());
      setSelectedId(id);
    };
    window.addEventListener('tl:openSetup', open);
    return () => {
      window.removeEventListener('tl:newSetup', fn);
      window.removeEventListener('tl:openSetup', open);
    };
  }, []);

  const handleSave = (note) => setNotes(Store.saveNote(note));
  const handleDelete = (id) => { setNotes(Store.deleteNote(id)); setSelectedId(null); };

  const filtered = notes.filter(n =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    n.blocks?.some(b => b.text?.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = notes.find(n => n.id === selectedId);

  return (
    <div className="notes-layout">
      <div className="notes-sidebar">
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input className="form-input" placeholder="Search..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px' }}/>
        </div>
        <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
          <Btn variant="ghost" size="sm" onClick={createNote} style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="plus" size={12}/> New Note
          </Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>No notes</div>
            : filtered.map(n => (
              <NoteListItem key={n.id} note={n} active={selectedId === n.id} onClick={() => setSelectedId(n.id)}/>
            ))
          }
        </div>
      </div>

      <div className="notes-editor-wrap">
        {selected
          ? <NoteEditor key={selected.id} note={selected} onSave={handleSave} onDelete={handleDelete} onBack={() => setSelectedId(null)}/>
          : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text3)', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 28, opacity: 0.25 }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)' }}>Select a note or create a new one</div>
              <div style={{ fontSize: 12 }}>
                Type <kbd style={{ padding: '2px 6px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>/</kbd> inside a note to insert blocks
              </div>
              <Btn variant="ghost" size="sm" onClick={createNote} style={{ marginTop: 4 }}>
                <Icon name="plus" size={12}/> New Note
              </Btn>
            </div>
          )
        }
      </div>
    </div>
  );
}
