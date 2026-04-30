import { useMemo, useState } from 'react';
import { Store } from '../lib/store.js';
import { Icon, Btn, Empty } from '../components/Shared.jsx';

function Item({ item, catId, onEdit, onDelete, usage, totalTrades }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  const commit = () => {
    if (text.trim()) onEdit(catId, item.id, text.trim());
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 8,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      marginBottom: 6, transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: 'var(--accent)',
      }}/>
      {editing ? (
        <input autoFocus className="form-input" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: 1, marginBottom: 0, padding: '4px 8px', fontSize: 13 }}/>
      ) : (
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{item.text}</span>
      )}
      {totalTrades > 0 && (
        <span title={`Tagged on ${usage || 0}/${totalTrades} trades`} style={{
          fontSize: 10, fontFamily: 'var(--mono)', flexShrink: 0,
          color: usage > 0 ? 'var(--accent)' : 'var(--text3)',
        }}>
          {usage > 0 ? `${usage}× used` : 'unused'}
        </span>
      )}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => setEditing(!editing)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
          title="Edit"><Icon name="edit" size={13}/></button>
        <button onClick={() => onDelete(catId, item.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
          title="Delete"><Icon name="trash" size={13}/></button>
      </div>
    </div>
  );
}

function CategoryBlock({ cat, onAddItem, onEditItem, onDeleteItem, onEditCatName, onDeleteCat, usage, totalTrades }) {
  const [addingText, setAddingText] = useState('');
  const [editingCat, setEditingCat] = useState(false);
  const [catName, setCatName] = useState(cat.category);

  const commitAdd = () => {
    if (addingText.trim()) {
      onAddItem(cat.id, addingText.trim());
      setAddingText('');
    }
  };
  const commitCat = () => {
    if (catName.trim()) onEditCatName(cat.id, catName.trim());
    setEditingCat(false);
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 3, height: 20, background: 'var(--accent)', borderRadius: 2 }}/>
        {editingCat ? (
          <input autoFocus className="form-input" value={catName}
            onChange={e => setCatName(e.target.value)}
            onBlur={commitCat}
            onKeyDown={e => { if (e.key === 'Enter') commitCat(); if (e.key === 'Escape') setEditingCat(false); }}
            style={{ fontSize: 14, fontWeight: 700, padding: '4px 8px' }}/>
        ) : (
          <h3 style={{ fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onDoubleClick={() => setEditingCat(true)}>{cat.category}</h3>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 2 }}>
          {cat.items.length} item{cat.items.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setEditingCat(!editingCat)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }} title="Rename category">
          <Icon name="edit" size={13}/>
        </button>
        <button onClick={() => onDeleteCat(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }} title="Delete category">
          <Icon name="trash" size={13}/>
        </button>
      </div>

      {cat.items.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 12px', fontStyle: 'italic' }}>
          No confluences yet — add one below.
        </div>
      )}
      {cat.items.map(item => (
        <Item key={item.id} item={item} catId={cat.id}
          usage={usage?.[item.text] || 0} totalTrades={totalTrades}
          onEdit={onEditItem} onDelete={onDeleteItem}/>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="form-input" placeholder="Add confluence..." value={addingText}
          onChange={e => setAddingText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitAdd(); }}
          style={{ flex: 1, fontSize: 13 }}/>
        <Btn variant="ghost" size="sm" onClick={commitAdd} disabled={!addingText.trim()}>
          <Icon name="plus" size={12}/>Add
        </Btn>
      </div>
    </div>
  );
}

export default function Confluences() {
  const [cnf, setCnf] = useState(() => Store.getConfluences());
  const [newCatName, setNewCatName] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (updated) => {
    setCnf(updated);
    Store.saveConfluences(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addItem = (catId, text) => save(cnf.map(cat =>
    cat.id === catId ? { ...cat, items: [...cat.items, { id: Store.uid(), text }] } : cat));
  const editItem = (catId, itemId, text) => save(cnf.map(cat =>
    cat.id === catId ? { ...cat, items: cat.items.map(i => i.id === itemId ? { ...i, text } : i) } : cat));
  const deleteItem = (catId, itemId) => save(cnf.map(cat =>
    cat.id === catId ? { ...cat, items: cat.items.filter(i => i.id !== itemId) } : cat));
  const editCatName = (catId, name) => save(cnf.map(cat => cat.id === catId ? { ...cat, category: name } : cat));
  const deleteCat = (catId) => save(cnf.filter(cat => cat.id !== catId));
  const addCategory = () => {
    if (!newCatName.trim()) return;
    save([...cnf, { id: Store.uid(), category: newCatName.trim(), items: [] }]);
    setNewCatName('');
  };

  const total = cnf.reduce((s, c) => s + c.items.length, 0);

  // Confluence usage across logged trades. Tells the user which confluences
  // they actually trade with vs which are aspirational dead weight.
  const { usage, totalTrades } = useMemo(() => {
    const trades = Store.getTrades();
    const u = {};
    for (const t of trades) for (const c of (t.confluences || [])) u[c] = (u[c] || 0) + 1;
    return { usage: u, totalTrades: trades.length };
  }, [cnf]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '12px 20px', display: 'flex', gap: 20, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Total Confluences</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{total}</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'var(--border)' }}/>
          <div>
            <div className="stat-label">Categories</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--accent)' }}>{cnf.length}</div>
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: saved ? 'var(--bull)' : 'var(--text3)' }}>
            {saved ? '✓ Saved' : 'Auto-saves on change'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--text2)' }}>
        These are the confluences you can tick when logging a trade. Add, edit, or delete them here — changes appear instantly in the Journal entry checklist.
      </div>

      {cnf.length === 0 ? (
        <Empty icon="✓" title="No confluences yet" desc="Add your first category below."/>
      ) : (
        cnf.map(cat => (
          <CategoryBlock key={cat.id} cat={cat}
            usage={usage} totalTrades={totalTrades}
            onAddItem={addItem} onEditItem={editItem}
            onDeleteItem={deleteItem}
            onEditCatName={editCatName} onDeleteCat={deleteCat}/>
        ))
      )}

      <div style={{
        marginTop: 8, padding: '16px 20px',
        background: 'var(--surface)', border: '1px dashed var(--border2)',
        borderRadius: 'var(--radius-lg)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input className="form-input" placeholder="New category name (e.g. Market Structure)..."
          value={newCatName} onChange={e => setNewCatName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
          style={{ flex: 1, minWidth: 200 }}/>
        <Btn variant="primary" onClick={addCategory} disabled={!newCatName.trim()}>
          <Icon name="plus" size={13}/>Add Category
        </Btn>
      </div>
    </div>
  );
}
