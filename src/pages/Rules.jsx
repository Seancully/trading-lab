import { useMemo, useState } from 'react';
import { Store } from '../lib/store.js';
import { Icon, Btn, Empty } from '../components/Shared.jsx';

// Pick a category icon based on the category name. Loose keyword match so the
// user can rename categories ("Daily Limits" → "Limits") and still get a sane
// icon. Falls back to a star.
function iconForCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('daily') || n.includes('limit') || n.includes('risk')) return 'shield';
  if (n.includes('do not') || n.includes("don't") || n.includes('avoid') || n.includes('skip')) return 'x';
  if (n.includes('entry') || n.includes('check') || n.includes('confluen')) return 'rules';
  if (n.includes('psych') || n.includes('mind') || n.includes('mood')) return 'sun';
  if (n.includes('exit') || n.includes('manage')) return 'short';
  return 'setups';
}

function RuleItem({ rule, catId, onToggleRequired, onEdit, onDelete, stat }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rule.text);

  const commit = () => {
    if (text.trim()) onEdit(catId, rule.id, text.trim());
    setEditing(false);
  };

  return (
    <div className="cat-row">
      <div title={rule.required ? 'Required rule — click to toggle' : 'Bonus rule — click to toggle'}
        onClick={() => onToggleRequired(catId, rule.id)}
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          background: rule.required ? 'var(--text)' : 'var(--accent)',
          boxShadow: rule.required ? '0 0 5px rgba(232,234,237,0.3)' : 'none',
          transition: 'all 0.2s',
        }}/>
      {editing ? (
        <input autoFocus className="form-input" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: 1, marginBottom: 0, padding: '4px 8px', fontSize: 13 }}/>
      ) : (
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{rule.text}</span>
      )}
      {stat && stat.total > 0 && (
        <span title={`Followed in ${stat.followed}/${stat.total} rules-scored trades`} style={{
          fontSize: 10, fontFamily: 'var(--mono)', flexShrink: 0,
          color: stat.pct >= 80 ? 'var(--bull)' : stat.pct >= 50 ? 'var(--accent)' : 'var(--bear)',
        }}>
          {stat.pct}% kept
        </span>
      )}
      {!rule.required && (
        <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>bonus</span>
      )}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => setEditing(!editing)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
          title="Edit rule"><Icon name="edit" size={13}/></button>
        <button onClick={() => onDelete(catId, rule.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
          title="Delete rule"><Icon name="trash" size={13}/></button>
      </div>
    </div>
  );
}

function CategoryBlock({ cat, onAddRule, onEditRule, onDeleteRule, onToggleRequired, onEditCatName, onDeleteCat, ruleStats }) {
  const [addingText, setAddingText] = useState('');
  const [editingCat, setEditingCat] = useState(false);
  const [catName, setCatName] = useState(cat.category);

  const commitAdd = () => {
    if (addingText.trim()) {
      onAddRule(cat.id, addingText.trim());
      setAddingText('');
    }
  };
  const commitCat = () => {
    if (catName.trim()) onEditCatName(cat.id, catName.trim());
    setEditingCat(false);
  };

  const required = cat.rules.filter(r => r.required).length;
  const bonus = cat.rules.filter(r => !r.required).length;

  return (
    <div className="cat-card">
      <div className="cat-card-head">
        <div className="cat-card-icon">
          <Icon name={iconForCategory(cat.category)} size={14}/>
        </div>
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
          {required} required · {bonus} bonus
        </span>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setEditingCat(!editingCat)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }} title="Rename category">
          <Icon name="edit" size={13}/>
        </button>
        <button onClick={() => onDeleteCat(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }} title="Delete category">
          <Icon name="trash" size={13}/>
        </button>
      </div>

      {cat.rules.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 12px', fontStyle: 'italic' }}>
          No rules yet — add one below.
        </div>
      )}
      {cat.rules.map(rule => (
        <RuleItem key={rule.id} rule={rule} catId={cat.id}
          stat={ruleStats?.[rule.id]}
          onEdit={onEditRule} onDelete={onDeleteRule} onToggleRequired={onToggleRequired}/>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="form-input" placeholder="Add rule..." value={addingText}
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

export default function Rules() {
  const [rules, setRules] = useState(() => Store.getRules());
  const [newCatName, setNewCatName] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (updated) => {
    setRules(updated);
    Store.saveRules(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addRule = (catId, text) => save(rules.map(cat =>
    cat.id === catId ? { ...cat, rules: [...cat.rules, { id: Store.uid(), text, required: true }] } : cat));
  const editRule = (catId, ruleId, text) => save(rules.map(cat =>
    cat.id === catId ? { ...cat, rules: cat.rules.map(r => r.id === ruleId ? { ...r, text } : r) } : cat));
  const deleteRule = (catId, ruleId) => save(rules.map(cat =>
    cat.id === catId ? { ...cat, rules: cat.rules.filter(r => r.id !== ruleId) } : cat));
  const toggleRequired = (catId, ruleId) => save(rules.map(cat =>
    cat.id === catId ? { ...cat, rules: cat.rules.map(r => r.id === ruleId ? { ...r, required: !r.required } : r) } : cat));
  const editCatName = (catId, name) => save(rules.map(cat => cat.id === catId ? { ...cat, category: name } : cat));
  const deleteCat = (catId) => save(rules.filter(cat => cat.id !== catId));
  const addCategory = () => {
    if (!newCatName.trim()) return;
    save([...rules, { id: Store.uid(), category: newCatName.trim(), rules: [] }]);
    setNewCatName('');
  };

  const totalRules = rules.reduce((s, c) => s + c.rules.length, 0);
  const requiredCount = rules.reduce((s, c) => s + c.rules.filter(r => r.required).length, 0);

  // How often each rule was followed across rules-scored trades. Lets the
  // user see at a glance which rules they actually keep vs which are aspiration.
  const ruleStats = useMemo(() => {
    const trades = Store.getTrades().filter(t => (t.rulesScore || 0) > 0);
    const map = {};
    rules.forEach(cat => cat.rules.forEach(r => { map[r.id] = { followed: 0, total: trades.length }; }));
    for (const t of trades) {
      const checks = t.rulesChecklist || {};
      for (const id in map) if (checks[id]) map[id].followed++;
    }
    for (const id in map) {
      const s = map[id];
      s.pct = s.total ? Math.round((s.followed / s.total) * 100) : 0;
    }
    return map;
  }, [rules]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '12px 20px', display: 'flex', gap: 20, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Total Rules</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{totalRules}</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'var(--border)' }}/>
          <div>
            <div className="stat-label">Required</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--accent)' }}>{requiredCount}</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'var(--border)' }}/>
          <div>
            <div className="stat-label">Bonus</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--text2)' }}>{totalRules - requiredCount}</div>
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: saved ? 'var(--bull)' : 'var(--text3)' }}>
            {saved ? '✓ Saved' : 'Auto-saves on change'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12, color: 'var(--text2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text)', display: 'inline-block', boxShadow: '0 0 5px rgba(232,234,237,0.3)' }}/>
          Required rule
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}/>
          Bonus rule
        </span>
        <span style={{ color: 'var(--text3)' }}>· Click dot to toggle · Double-click name to rename · Rules are checked per trade</span>
      </div>

      {rules.length === 0 ? (
        <Empty icon="📋" title="No rules yet" desc="Add your first category below to define your trading rules."/>
      ) : (
        <div className="cat-grid">
          {rules.map(cat => (
            <CategoryBlock key={cat.id} cat={cat} ruleStats={ruleStats}
              onAddRule={addRule} onEditRule={editRule}
              onDeleteRule={deleteRule} onToggleRequired={toggleRequired}
              onEditCatName={editCatName} onDeleteCat={deleteCat}/>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 8, padding: '16px 20px',
        background: 'var(--surface)', border: '1px dashed var(--border2)',
        borderRadius: 'var(--radius-lg)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input className="form-input" placeholder="New category name (e.g. Psychology)..."
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
