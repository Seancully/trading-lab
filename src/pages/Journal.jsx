import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, effectivePnl } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import {
  Icon, Badge, DirBadge, PnlText, RText, Modal, Btn, Tabs, Sep, Empty, Chip,
  FInput, FSelect, FTextarea, GradeBadge, GRADES, GRADE_META,
} from '../components/Shared.jsx';
import Lightbox from '../components/Lightbox.jsx';

function FilterChipGroup({ label, options, selected, onToggle }) {
  if (!options.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', minWidth: 88, paddingTop: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className="chip"
              style={{
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                color: active ? 'var(--accent)' : 'var(--text2)',
                borderColor: active ? 'var(--accentBorder)' : 'var(--border)',
                background: active ? 'var(--accentDim)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ENTRY_MODELS = [
  'HTF PDA → IFVG', 'Internal → External (Sweep Short)', 'Internal → External (Sweep Long)',
  'Internal → External (Break Long)', 'Internal → External (Break Short)',
  'SMT + IFVG', 'OB + CE', 'FVG Rebalance', 'BPR Entry', 'LRL Bounce', 'Other',
];

const SESSIONS = ['London', 'NY AM Kill Zone', 'NY Lunch', 'NY PM', 'Asia', 'Other'];

function TradeCard({ trade, onClick, onDelete, onGrade, accountFilter, draggable, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const { date, time, instrument, direction, result, rMultiple, screenshotUrl, entryModel, accounts } = trade;
  const [hovered, setHovered] = useState(false);
  const inScope = accountFilter == null
    ? (accounts || [])
    : (accounts || []).filter(a => accountFilter.includes(a.name));
  const accountLabel = inScope.length
    ? inScope.map(a => `${a.name}${a.contracts > 1 ? ` ×${a.contracts}` : ''}`).join(', ')
    : '—';
  const cardPnl = effectivePnl(trade, accountFilter);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete trade from ${date}?`)) onDelete(trade.id || trade);
  };

  return (
    <div
      className={`trade-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={() => onClick(trade)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={!!draggable}
      onDragStart={(e) => onDragStart?.(e, trade.id)}
      onDragOver={(e) => onDragOver?.(e, trade.id)}
      onDrop={(e) => onDrop?.(e, trade.id)}
      onDragEnd={onDragEnd}
    >
      <div className="quick-actions">
        <button className="quick-action-btn danger" onClick={handleDelete} title="Delete trade">
          <Icon name="trash" size={12}/>
        </button>
      </div>
      <div style={{
        height: 130, background: 'var(--bg)', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {screenshotUrl ? (
          <img src={screenshotUrl} alt="chart" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 10,
            border: '1.5px dashed var(--border2)', borderRadius: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', gap: 4,
          }}>
            <Icon name="image" size={22}/>
            <div style={{ fontSize: 10, letterSpacing: '0.04em' }}>Drop a screenshot</div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <DirBadge dir={direction}/>
          <Badge result={result}/>
          {trade.grade && <GradeBadge grade={trade.grade}/>}
          <span style={{ flex: 1 }}/>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{instrument}</span>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{date}{time && ` · ${time}`}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entryModel}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <PnlText value={cardPnl} size={16}/>
          <RText value={rMultiple}/>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountLabel}</div>
      </div>

      {/* Quick-grade bar — appears on hover, no modal needed */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', gap: 4, padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        {GRADES.map(g => {
          const m = GRADE_META[g];
          const active = trade.grade === g;
          return (
            <button key={g}
              title={`${g} — ${m.label}`}
              onClick={() => onGrade?.(trade.id, active ? null : g)}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: 5,
                border: `1px solid ${active ? m.border : 'var(--border2)'}`,
                background: active ? m.bg : 'transparent',
                color: active ? m.color : 'var(--text3)',
                fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11,
                cursor: 'pointer', transition: 'all 0.1s',
              }}>
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccountRow({ acc, settings, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
      <div style={{ flex: 2 }}>
        <FSelect value={acc.name} onChange={v => onChange({ ...acc, name: v })} options={settings.accounts}/>
      </div>
      <div style={{ flex: 1 }}>
        <FInput type="number" min="1" step="1" value={acc.contracts}
          onChange={v => onChange({ ...acc, contracts: Number(v) })} placeholder="Contracts"/>
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--bear)', cursor: 'pointer', padding: '8px 4px' }}>
        <Icon name="x" size={14}/>
      </button>
    </div>
  );
}

function TradeModal({ trade: initTrade, rules, settings, onSave, onDelete, onClose, isNew }) {
  const emptyTrade = {
    id: Store.uid(),
    date: new Date().toISOString().slice(0, 10),
    time: '',
    instrument: 'MNQ',
    accounts: [{ name: settings.accounts[0] || 'MNQ Main', contracts: 1 }],
    direction: 'Long',
    htfBias: 'Bullish',
    session: 'NY AM Kill Zone',
    entryModel: 'HTF PDA → IFVG',
    confluences: [],
    riskDollars: settings.defaultRisk || 150,
    rMultiple: '',
    pnlDollars: '',
    result: 'Win',
    rulesChecklist: {},
    rulesScore: 0,
    review: '',
    lesson: '',
    grade: null,
    gradeNote: '',
    screenshotUrl: null,
    outlook: { mnqImageUrl: null, mesImageUrl: null, notes: '' },
  };

  const [trade, setTrade] = useState(initTrade || emptyTrade);
  const [tab, setTab] = useState('Details');
  const [dragging, setDragging] = useState(false);
  const [confluenceGroups, setConfluenceGroups] = useState(() => Store.getConfluences());
  const [zoomImage, setZoomImage] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const fn = (e) => { if (Array.isArray(e.detail)) setConfluenceGroups(e.detail); };
    window.addEventListener('tl:confluencesUpdated', fn);
    return () => window.removeEventListener('tl:confluencesUpdated', fn);
  }, []);

  const set = (key, val) => setTrade(t => ({ ...t, [key]: val }));

  const handleRChange = (r) => {
    const rNum = parseFloat(r);
    const pnl = isNaN(rNum) ? '' : Math.round(rNum * (trade.riskDollars || 150));
    setTrade(t => ({
      ...t, rMultiple: r, pnlDollars: pnl,
      result: isNaN(rNum) ? t.result : rNum > 0 ? 'Win' : rNum < 0 ? 'Loss' : 'BE',
    }));
  };

  const handlePnlChange = (p) => {
    const pNum = parseFloat(p);
    const r = isNaN(pNum) || !trade.riskDollars ? '' : +(pNum / trade.riskDollars).toFixed(2);
    setTrade(t => ({
      ...t, pnlDollars: p, rMultiple: r,
      result: isNaN(pNum) ? t.result : pNum > 0 ? 'Win' : pNum < 0 ? 'Loss' : 'BE',
    }));
  };

  const handleConfluence = (c) => {
    const existing = trade.confluences || [];
    set('confluences', existing.includes(c) ? existing.filter(x => x !== c) : [...existing, c]);
  };

  const handleRuleCheck = (ruleId, val) => {
    const next = { ...trade.rulesChecklist, [ruleId]: val };
    const allRules = rules.flatMap(cat => cat.rules);
    const checked = allRules.filter(r => next[r.id]).length;
    const score = allRules.length ? Math.round((checked / allRules.length) * 100) : 0;
    setTrade(t => ({ ...t, rulesChecklist: next, rulesScore: score }));
  };

  const handleImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const compressed = await Store.compressImage(file);
    set('screenshotUrl', compressed);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleImage(e.dataTransfer.files[0]);
  };

  const handlePaste = (e) => {
    const target = e.target;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleImage(file);
          return;
        }
      }
    }
  };

  const handleSave = () => {
    const t = { ...trade, rMultiple: parseFloat(trade.rMultiple) || 0, pnlDollars: parseFloat(trade.pnlDollars) || 0 };
    onSave(t);
    onClose();
  };

  const totalPnl = trade.accounts?.reduce((sum, a) => sum + (parseFloat(trade.pnlDollars) || 0) * a.contracts, 0) || 0;

  return (
    <Modal
      title={isNew ? 'New Trade Entry' : `Trade — ${trade.date}`}
      onClose={onClose}
      maxWidth={860}
      footer={
        <>
          {!isNew && <Btn variant="danger" onClick={() => { onDelete(trade.id); onClose(); }}><Icon name="trash" size={13}/>Delete</Btn>}
          <div style={{ flex: 1 }}/>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave}><Icon name="save" size={13}/>Save Trade</Btn>
        </>
      }
    >
      <div onPaste={handlePaste}>
        <Tabs tabs={['Details', 'Outlook', 'Confluences', 'Rules', 'Review']} active={tab} onChange={setTab}/>

        {tab === 'Details' && (
          <div style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
            <FInput label="Date" type="date" value={trade.date} onChange={v => set('date', v)}/>
            <FInput label="Time (NY)" type="time" value={trade.time} onChange={v => set('time', v)}/>
            <FSelect label="Instrument" value={trade.instrument} onChange={v => set('instrument', v)} options={['MNQ', 'MES', 'NQ', 'ES']}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
            <FSelect label="Direction" value={trade.direction}
              onChange={v => setTrade(t => ({ ...t, direction: v, htfBias: v === 'Long' ? 'Bullish' : 'Bearish' }))}
              options={['Long', 'Short']}/>
            <FSelect label="HTF Bias" value={trade.htfBias} onChange={v => set('htfBias', v)} options={['Bullish', 'Bearish', 'Neutral']}/>
            <FSelect label="Session" value={trade.session} onChange={v => set('session', v)} options={SESSIONS}/>
          </div>

          <FSelect label="Entry Model" value={trade.entryModel} onChange={v => set('entryModel', v)} options={ENTRY_MODELS}/>

          <Sep label="Accounts & Contracts"/>
          {trade.accounts.map((acc, i) => (
            <AccountRow key={i} acc={acc} settings={settings}
              onChange={v => { const a = [...trade.accounts]; a[i] = v; set('accounts', a); }}
              onRemove={() => set('accounts', trade.accounts.filter((_, j) => j !== i))}
            />
          ))}
          <Btn variant="ghost" size="sm" onClick={() => set('accounts', [...trade.accounts, { name: settings.accounts[0], contracts: 1 }])}>
            <Icon name="plus" size={12}/> Add Account
          </Btn>

          <Sep label="Risk & Result"/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
            <FInput label="Risk per Contract ($)" type="number" value={trade.riskDollars} onChange={v => set('riskDollars', Number(v))} placeholder="150"/>
            <FInput label="R-Multiple" type="number" step="0.01" value={trade.rMultiple} onChange={handleRChange} placeholder="e.g. 2.5"/>
            <FInput label="P&L ($)" type="number" value={trade.pnlDollars} onChange={handlePnlChange} placeholder="auto-calc"/>
            <FSelect label="Result" value={trade.result} onChange={v => set('result', v)} options={['Win', 'Loss', 'BE']}/>
          </div>

          {trade.accounts.length > 1 && (
            <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
              Combined P&L across {trade.accounts.length} accounts: <PnlText value={totalPnl} size={13}/>
            </div>
          )}

          <Sep label="Chart Screenshot"/>
          <div
            className={`upload-area ${dragging ? 'drag-over' : ''}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
            {trade.screenshotUrl ? (
              <div>
                <img
                  src={trade.screenshotUrl}
                  alt="chart"
                  className="lightbox-trigger"
                  onClick={(e) => { e.stopPropagation(); setZoomImage({ src: trade.screenshotUrl, caption: `Chart — ${trade.date}${trade.time ? ' · ' + trade.time : ''}` }); }}
                  style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 6 }}/>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>Click image to zoom · click outside to replace</div>
              </div>
            ) : (
              <>
                <Icon name="upload" size={24}/>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>Drop or paste chart screenshot, or click to upload</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>PNG, JPG — auto-compressed</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage(e.target.files[0])}/>
        </div>
        )}

        {tab === 'Outlook' && (
          <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
            Pre-session context. Upload your MNQ and MES charts side by side, then note your bias and key levels below.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { key: 'mnqImageUrl', label: 'MNQ — Primary' },
              { key: 'mesImageUrl', label: 'MES — Correlation' },
            ].map(({ key, label }) => (
              <OutlookUpload key={key} label={label} url={trade.outlook?.[key]}
                onChange={url => set('outlook', { ...(trade.outlook || {}), [key]: url })}
                onZoom={(src) => setZoomImage({ src, caption: `${label} — ${trade.date}` })}/>
            ))}
          </div>

          <FTextarea
            label="Pre-Session Bias & Narrative"
            value={trade.outlook?.notes || ''}
            onChange={v => set('outlook', { ...(trade.outlook || {}), notes: v })}
            placeholder="HTF narrative, key levels to watch, DOLs in draw, session expectations, SMT levels on MNQ vs MES..."
            rows={5}
          />
          </div>
        )}

        {tab === 'Confluences' && (
          <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
            Check all confluences that were present for this trade. Edit this list on the <strong style={{ color: 'var(--text2)' }}>Confluences</strong> page.
          </p>
          {confluenceGroups.length === 0 ? (
            <Empty icon="✓" title="No confluences defined" desc="Add some on the Confluences page to start ticking them here."/>
          ) : confluenceGroups.map(cat => (
            <div key={cat.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 6 }}>
                {cat.category}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
                {cat.items.map(item => (
                  <label key={item.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(trade.confluences || []).includes(item.text)}
                      onChange={() => handleConfluence(item.text)}/>
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {trade.confluences?.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {trade.confluences.map(c => <Chip key={c} label={c} accent/>)}
            </div>
          )}
          </div>
        )}

        {tab === 'Rules' && (
          <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 12, color: 'var(--text2)' }}>Check each rule that was followed for this trade.</p>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: trade.rulesScore >= 80 ? 'var(--bull)' : trade.rulesScore >= 60 ? 'var(--accent)' : 'var(--bear)' }}>
              Score: {trade.rulesScore}%
            </div>
          </div>
          {rules.map(cat => (
            <div key={cat.id} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8 }}>
                {cat.category}
              </div>
              {cat.rules.map(r => (
                <label key={r.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={!!trade.rulesChecklist[r.id]}
                    onChange={e => handleRuleCheck(r.id, e.target.checked)}
                  />
                  <span style={{ flex: 1 }}>{r.text}</span>
                  {!r.required && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>bonus</span>}
                </label>
              ))}
            </div>
          ))}
          </div>
        )}

        {tab === 'Review' && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Execution grade ── */}
          <div>
            <label className="form-label">Execution Grade</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {GRADES.map(g => {
                const m = GRADE_META[g];
                const active = trade.grade === g;
                return (
                  <button key={g} onClick={() => set('grade', active ? null : g)}
                    style={{
                      flex: 1, padding: '10px 4px', borderRadius: 8,
                      border: `1.5px solid ${active ? m.border : 'var(--border2)'}`,
                      background: active ? m.bg : 'transparent',
                      color: active ? m.color : 'var(--text3)',
                      fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15,
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                    {g}
                    <span style={{ fontSize: 9, fontWeight: 500, fontFamily: 'var(--font)',
                      opacity: active ? 0.85 : 0.5, letterSpacing: '0.02em' }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {trade.grade && (
            <FInput label="Execution note (optional)"
              value={trade.gradeNote || ''} onChange={v => set('gradeNote', v)}
              placeholder={`Why ${trade.grade}? e.g. "Entered 2 ticks past the level"`}/>
          )}

          <FTextarea label="Trade Review — What happened?" value={trade.review} onChange={v => set('review', v)}
            placeholder="Describe the trade: what you saw, how you entered, how it played out..." rows={5}/>
          <FTextarea label="Lesson / Key Takeaway" value={trade.lesson} onChange={v => set('lesson', v)}
            placeholder="What does this trade teach you? What would you do differently?" rows={4}/>
          </div>
        )}

        {zoomImage && <Lightbox src={zoomImage.src} caption={zoomImage.caption} onClose={() => setZoomImage(null)}/>}
      </div>
    </Modal>
  );
}

function OutlookUpload({ label, url, onChange, onZoom }) {
  const ref = useRef();
  const [hover, setHover] = useState(false);
  return (
    <div>
      <div className="form-label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="upload-area"
        style={{ padding: url ? 0 : 20, overflow: 'hidden', position: 'relative', minHeight: 120 }}
        onClick={() => ref.current.click()}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      >
        {url ? (
          <>
            <img
              src={url} alt={label}
              className="lightbox-trigger"
              onClick={(e) => { e.stopPropagation(); onZoom?.(url); }}
              style={{ width: '100%', display: 'block', borderRadius: 8 }}/>
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: hover ? 1 : 0, transition: 'opacity 0.15s', borderRadius: 8,
              fontSize: 12, color: '#fff', pointerEvents: 'none',
            }}>Click image to zoom</div>
          </>
        ) : (
          <>
            <Icon name="image" size={20}/>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Upload {label} chart</div>
          </>
        )}
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            onChange(await Store.compressImage(f));
          }}/>
      </div>
    </div>
  );
}

export default function Journal({ rules, settings, openTradeId, onOpenHandled, accountFilter }) {
  const [trades, setTrades] = useState(() => Store.getTrades());
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(() => Store.getTradeOrder() ? 'manual' : 'newest');
  const [showFilters, setShowFilters] = useState(false);
  const [setupFilter, setSetupFilter] = useState([]);
  const [sessionFilter, setSessionFilter] = useState([]);
  const [instrumentFilter, setInstrumentFilter] = useState([]);
  const [confluenceFilter, setConfluenceFilter] = useState([]);
  const [gradeFilter, setGradeFilter] = useState([]);

  const toggleFromArray = (arr, setArr, val) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };
  const clearAllFilters = () => {
    setSetupFilter([]); setSessionFilter([]); setInstrumentFilter([]); setConfluenceFilter([]); setGradeFilter([]);
  };

  // Distinct option lists pulled from logged trades. Sorted alphabetically so
  // the chip rows stay stable as new trades are added.
  const filterOptions = useMemo(() => {
    const setups = new Set(), sessions = new Set(), instruments = new Set(), confluences = new Set();
    for (const t of trades) {
      if (t.entryModel) setups.add(t.entryModel);
      if (t.session) sessions.add(t.session);
      if (t.instrument) instruments.add(t.instrument);
      (t.confluences || []).forEach(c => confluences.add(c));
    }
    const sortArr = (s) => [...s].sort((a, b) => a.localeCompare(b));
    return {
      setups: sortArr(setups),
      sessions: sortArr(sessions),
      instruments: sortArr(instruments),
      confluences: sortArr(confluences),
    };
  }, [trades]);

  const activeFilterCount = setupFilter.length + sessionFilter.length + instrumentFilter.length + confluenceFilter.length + gradeFilter.length;
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    const fn = () => setAdding(true);
    window.addEventListener('tl:newTrade', fn);
    return () => window.removeEventListener('tl:newTrade', fn);
  }, []);

  const autoTrade = useMemo(() => {
    if (!openTradeId) return null;
    return trades.find(t => t.id === openTradeId) || null;
  }, [openTradeId, trades]);

  useEffect(() => {
    if (openTradeId && autoTrade && onOpenHandled) onOpenHandled();
  }, [openTradeId, autoTrade, onOpenHandled]);

  const handleSave = (trade) => {
    setTrades(Store.saveTrade(trade));
    toast.success('Trade saved');
  };
  const handleDelete = (id) => {
    setTrades(Store.deleteTrade(id));
    toast.info('Trade deleted');
  };
  const handleGrade = (id, grade) => {
    const t = trades.find(t => t.id === id);
    if (!t) return;
    setTrades(Store.saveTrade({ ...t, grade: grade || null }));
  };

  let visible = [...trades];
  if (accountFilter != null) {
    if (Array.isArray(accountFilter) && !accountFilter.length) visible = [];
    else visible = visible.filter(t => t.accounts?.some(a => accountFilter.includes(a.name)));
  }
  if (filter !== 'All') visible = visible.filter(t => t.result === filter);
  if (setupFilter.length) visible = visible.filter(t => setupFilter.includes(t.entryModel));
  if (sessionFilter.length) visible = visible.filter(t => sessionFilter.includes(t.session));
  if (instrumentFilter.length) visible = visible.filter(t => instrumentFilter.includes(t.instrument));
  if (confluenceFilter.length) visible = visible.filter(t =>
    (t.confluences || []).some(c => confluenceFilter.includes(c))
  );
  if (gradeFilter.length) visible = visible.filter(t =>
    gradeFilter.includes(t.grade || 'Ungraded')
  );
  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter(t =>
      t.entryModel?.toLowerCase().includes(q) ||
      t.date?.includes(q) ||
      t.instrument?.toLowerCase().includes(q) ||
      t.accounts?.some(a => a.name.toLowerCase().includes(q))
    );
  }
  // Use date + time so same-day trades sort by intraday time too.
  const ts = (t) => `${t.date || ''}T${t.time || '00:00'}`;
  if (sort === 'newest') visible.sort((a, b) => ts(b).localeCompare(ts(a)));
  else if (sort === 'oldest') visible.sort((a, b) => ts(a).localeCompare(ts(b)));
  else if (sort === 'pnl-hi') visible.sort((a, b) => effectivePnl(b, accountFilter) - effectivePnl(a, accountFilter));
  else if (sort === 'pnl-lo') visible.sort((a, b) => effectivePnl(a, accountFilter) - effectivePnl(b, accountFilter));
  else if (sort === 'manual') {
    const order = Store.getTradeOrder() || [];
    const indexOf = (id) => { const i = order.indexOf(id); return i === -1 ? order.length : i; };
    visible.sort((a, b) => indexOf(a.id) - indexOf(b.id));
  }

  // Drag-to-reorder. Only meaningful in 'manual' sort, but switching the user
  // to manual on first drag is friendly.
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null); setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    // Build new order from currently-visible list (so the reorder is intuitive)
    const ids = visible.map(t => t.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // Append any trades not in the visible set so we keep their relative order at the end
    const tail = trades.filter(t => !ids.includes(t.id)).map(t => t.id);
    const newOrder = [...ids, ...tail];
    Store.saveTradeOrder(newOrder);
    if (sort !== 'manual') setSort('manual');
    setTrades([...trades]); // force re-render with new order
    toast.info('Order saved');
  };
  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null); };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <Tabs tabs={['All', 'Win', 'Loss', 'BE']} active={filter} onChange={setFilter}/>
        <input className="form-input" style={{ width: 200, marginBottom: 0 }} placeholder="Search trades..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="form-select" style={{ width: 150 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="pnl-hi">P&L ↑</option>
          <option value="pnl-lo">P&L ↓</option>
          <option value="manual">Manual order</option>
        </select>
        <Btn variant={showFilters || activeFilterCount > 0 ? 'primary' : 'ghost'} onClick={() => setShowFilters(s => !s)}>
          <Icon name="filter" size={13}/>
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </Btn>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{visible.length} trade{visible.length !== 1 ? 's' : ''}</div>
        <Btn variant="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14}/> New Trade
        </Btn>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <FilterChipGroup label="Grade"      options={[...GRADES, 'Ungraded']}     selected={gradeFilter}      onToggle={(v) => toggleFromArray(gradeFilter, setGradeFilter, v)}/>
          <FilterChipGroup label="Setup"      options={filterOptions.setups}        selected={setupFilter}      onToggle={(v) => toggleFromArray(setupFilter, setSetupFilter, v)}/>
          <FilterChipGroup label="Session"    options={filterOptions.sessions}      selected={sessionFilter}    onToggle={(v) => toggleFromArray(sessionFilter, setSessionFilter, v)}/>
          <FilterChipGroup label="Instrument" options={filterOptions.instruments}   selected={instrumentFilter} onToggle={(v) => toggleFromArray(instrumentFilter, setInstrumentFilter, v)}/>
          <FilterChipGroup label="Confluence" options={filterOptions.confluences}   selected={confluenceFilter} onToggle={(v) => toggleFromArray(confluenceFilter, setConfluenceFilter, v)}/>
          {activeFilterCount > 0 && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l4-8 4 4 4-6 4 3"/>
              <path d="M3 21h18" opacity="0.3"/>
            </svg>
          </div>
          <h3>{search || filter !== 'All' ? 'No trades match' : 'No trades yet'}</h3>
          <p>{search || filter !== 'All' ? 'Try clearing your filter or search.' : 'Start logging trades — your equity curve grows from here.'}</p>
          <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={() => setAdding(true)}><Icon name="plus" size={14}/>Log Your First Trade</Btn>
            {trades.length === 0 && (
              <Btn variant="ghost" onClick={() => {
                if (window.confirm('Load 15 sample trades? You can delete them anytime.')) {
                  setTrades(Store.loadSampleTrades());
                  toast.success('Sample trades loaded');
                }
              }}>Load sample data</Btn>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {visible.map(t => (
            <TradeCard
              key={t.id} trade={t} onClick={setSelected} onDelete={handleDelete} onGrade={handleGrade}
              accountFilter={accountFilter}
              draggable
              isDragging={draggingId === t.id}
              isDragOver={dragOverId === t.id && draggingId !== t.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}/>
          ))}
        </div>
      )}

      { (autoTrade || selected) && (
        <TradeModal trade={autoTrade || selected} rules={rules} settings={settings}
          onSave={handleSave} onDelete={handleDelete}
          onClose={() => { if (onOpenHandled) onOpenHandled(); setSelected(null); }} isNew={false}/>
      )}
      {adding && (
        <TradeModal trade={null} rules={rules} settings={settings}
          onSave={handleSave} onDelete={() => {}}
          onClose={() => setAdding(false)} isNew={true}/>
      )}
    </div>
  );
}
