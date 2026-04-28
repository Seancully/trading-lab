import { useEffect, useRef, useState } from 'react';
import { Store } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import {
  Icon, Badge, DirBadge, PnlText, RText, Modal, Btn, Tabs, Sep, Empty, Chip,
  FInput, FSelect, FTextarea,
} from '../components/Shared.jsx';

const CONFLUENCE_OPTIONS = [
  'HTF PDA Alignment', 'IFVG Present', 'SMT Confirmed', 'Strong DOL in Draw',
  'Internal BSL Swept', 'Internal SSL Swept', 'External BSL Target', 'External SSL Target',
  'LRL Respected', 'Displacement Confirmed', 'Inducement Visible',
  'Session Timing Correct', 'London Open', 'NY Open Kill Zone',
  '2022 Opening Range', 'OB Mitigation', 'FVG Mitigated', 'BPR Present',
];

const ENTRY_MODELS = [
  'HTF PDA → IFVG', 'Internal → External (Sweep Short)', 'Internal → External (Sweep Long)',
  'Internal → External (Break Long)', 'Internal → External (Break Short)',
  'SMT + IFVG', 'OB + CE', 'FVG Rebalance', 'BPR Entry', 'LRL Bounce', 'Other',
];

const SESSIONS = ['London', 'NY AM Kill Zone', 'NY Lunch', 'NY PM', 'Asia', 'Other'];

function TradeCard({ trade, onClick, onDelete }) {
  const { date, time, instrument, direction, result, pnlDollars, rMultiple, screenshotUrl, entryModel, accounts } = trade;
  const accountLabel = accounts?.map(a => a.name).join(', ') || '—';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete trade from ${date}?`)) onDelete(trade.id);
  };

  return (
    <div className="trade-card" onClick={() => onClick(trade)}>
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
          <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
            <Icon name="image" size={28}/>
            <div style={{ fontSize: 10, marginTop: 4 }}>No chart</div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8 }}><Badge result={result}/></div>
        <div style={{ position: 'absolute', top: 8, left: 8 }}><DirBadge dir={direction}/></div>
      </div>

      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{date}{time && ` · ${time}`}</span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{instrument}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entryModel}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <PnlText value={pnlDollars} size={16}/>
          <RText value={rMultiple}/>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountLabel}</div>
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
    screenshotUrl: null,
    outlook: { mnqImageUrl: null, mesImageUrl: null, notes: '' },
  };

  const [trade, setTrade] = useState(initTrade || emptyTrade);
  const [tab, setTab] = useState('Details');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

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
          >
            {trade.screenshotUrl ? (
              <div>
                <img src={trade.screenshotUrl} alt="chart" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 6 }}/>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>Click or drag to replace</div>
              </div>
            ) : (
              <>
                <Icon name="upload" size={24}/>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>Drop chart screenshot here or click to upload</div>
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
                onChange={url => set('outlook', { ...(trade.outlook || {}), [key]: url })}/>
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
            Check all confluences that were present for this trade. More checks = more conviction, but quality over quantity.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
            {CONFLUENCE_OPTIONS.map(c => (
              <label key={c} className="checkbox-item">
                <input type="checkbox" checked={(trade.confluences || []).includes(c)} onChange={() => handleConfluence(c)}/>
                <span>{c}</span>
              </label>
            ))}
          </div>
          {trade.confluences?.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FTextarea label="Trade Review — What happened?" value={trade.review} onChange={v => set('review', v)}
            placeholder="Describe the trade: what you saw, how you entered, how it played out..." rows={5}/>
          <FTextarea label="Lesson / Key Takeaway" value={trade.lesson} onChange={v => set('lesson', v)}
            placeholder="What does this trade teach you? What would you do differently?" rows={4}/>
        </div>
      )}
    </Modal>
  );
}

function OutlookUpload({ label, url, onChange }) {
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
            <img src={url} alt={label} style={{ width: '100%', display: 'block', borderRadius: 8 }}/>
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: hover ? 1 : 0, transition: 'opacity 0.15s', borderRadius: 8,
              fontSize: 12, color: '#fff',
            }}>Click to replace</div>
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

export default function Journal({ rules, settings }) {
  const [trades, setTrades] = useState(() => Store.getTrades());
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    const fn = () => setAdding(true);
    window.addEventListener('tl:newTrade', fn);
    return () => window.removeEventListener('tl:newTrade', fn);
  }, []);

  const handleSave = (trade) => {
    setTrades(Store.saveTrade(trade));
    toast.success('Trade saved');
  };
  const handleDelete = (id) => {
    setTrades(Store.deleteTrade(id));
    toast.info('Trade deleted');
  };

  let visible = [...trades];
  if (filter !== 'All') visible = visible.filter(t => t.result === filter);
  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter(t =>
      t.entryModel?.toLowerCase().includes(q) ||
      t.date?.includes(q) ||
      t.instrument?.toLowerCase().includes(q) ||
      t.accounts?.some(a => a.name.toLowerCase().includes(q))
    );
  }
  if (sort === 'newest') visible.sort((a, b) => b.date.localeCompare(a.date));
  else if (sort === 'oldest') visible.sort((a, b) => a.date.localeCompare(b.date));
  else if (sort === 'pnl-hi') visible.sort((a, b) => b.pnlDollars - a.pnlDollars);
  else if (sort === 'pnl-lo') visible.sort((a, b) => a.pnlDollars - b.pnlDollars);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <Tabs tabs={['All', 'Win', 'Loss', 'BE']} active={filter} onChange={setFilter}/>
        <input className="form-input" style={{ width: 200, marginBottom: 0 }} placeholder="Search trades..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="form-select" style={{ width: 130 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="pnl-hi">P&L ↑</option>
          <option value="pnl-lo">P&L ↓</option>
        </select>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{visible.length} trade{visible.length !== 1 ? 's' : ''}</div>
        <Btn variant="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14}/> New Trade
        </Btn>
      </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {visible.map(t => (
            <TradeCard key={t.id} trade={t} onClick={setSelected} onDelete={handleDelete}/>
          ))}
        </div>
      )}

      {selected && (
        <TradeModal trade={selected} rules={rules} settings={settings}
          onSave={handleSave} onDelete={handleDelete}
          onClose={() => setSelected(null)} isNew={false}/>
      )}
      {adding && (
        <TradeModal trade={null} rules={rules} settings={settings}
          onSave={handleSave} onDelete={() => {}}
          onClose={() => setAdding(false)} isNew={true}/>
      )}
    </div>
  );
}
