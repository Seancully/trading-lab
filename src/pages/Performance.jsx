import { useEffect, useMemo, useRef, useState } from 'react';
import { Store } from '../lib/store.js';
import { Tabs, StatCard, Empty, Icon } from '../components/Shared.jsx';

// ── Compute stats from trades ─────────────────────────────────────────────────
export function calcStats(trades) {
  if (!trades.length) return null;
  const wins = trades.filter(t => t.result === 'Win');
  const losses = trades.filter(t => t.result === 'Loss');
  const bes = trades.filter(t => t.result === 'BE');

  const totalPnl = trades.reduce((s, t) => s + (Number(t.pnlDollars) || 0), 0);
  const grossWin = wins.reduce((s, t) => s + (Number(t.pnlDollars) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.pnlDollars) || 0), 0));
  const profitFactor = grossLoss === 0 ? grossWin > 0 ? '∞' : '—' : (grossWin / grossLoss).toFixed(2);
  const winRate = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : 0;
  const avgRWin = wins.length ? (wins.reduce((s, t) => s + (Number(t.rMultiple) || 0), 0) / wins.length).toFixed(2) : 0;
  const avgRLoss = losses.length ? (losses.reduce((s, t) => s + (Number(t.rMultiple) || 0), 0) / losses.length).toFixed(2) : 0;
  const scored = trades.filter(t => t.rulesScore > 0);
  const avgRulesScore = scored.length
    ? Math.round(scored.reduce((s, t) => s + t.rulesScore, 0) / scored.length)
    : null;

  let peak = 0, running = 0, maxDD = 0;
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    running += Number(t.pnlDollars) || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  const byDay = {};
  for (const t of trades) byDay[t.date] = (byDay[t.date] || 0) + (Number(t.pnlDollars) || 0);
  const dayVals = Object.values(byDay);
  const bestDay = dayVals.length ? Math.max(...dayVals) : 0;
  const worstDay = dayVals.length ? Math.min(...dayVals) : 0;

  let streak = 0, streakType = 'Win';
  const byDate = [...trades].sort((a, b) => b.date.localeCompare(a.date));
  if (byDate.length) {
    streakType = byDate[0].result;
    for (const t of byDate) {
      if (t.result === streakType) streak++;
      else break;
    }
  }

  let cum = 0;
  const equity = sorted.map(t => { cum += Number(t.pnlDollars) || 0; return { date: t.date, value: cum }; });

  return {
    total: trades.length, wins: wins.length, losses: losses.length, bes: bes.length,
    totalPnl, grossWin, grossLoss, profitFactor, winRate, avgRWin, avgRLoss,
    avgRulesScore, maxDD, bestDay, worstDay, streak, streakType, equity, byDay,
  };
}

// ── Equity curve canvas ───────────────────────────────────────────────────────
export function EquityCurve({ equity }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !equity.length) return;
    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      if (!W || !H) { requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      paint(ctx, W, H);
    };

    const paint = (ctx, W, H) => {

    const pad = { t: 16, r: 16, b: 32, l: 56 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

    const vals = equity.map(e => e.value);
    const minV = Math.min(0, ...vals), maxV = Math.max(0, ...vals);
    const range = maxV - minV || 1;

    const xOf = (i) => pad.l + (i / (equity.length - 1 || 1)) * cw;
    const yOf = (v) => pad.t + ch - ((v - minV) / range) * ch;

    const style = getComputedStyle(document.body);
    const colorBull = style.getPropertyValue('--bullStroke').trim() || '#22C55E';
    const colorBear = style.getPropertyValue('--bearStroke').trim() || '#EF4444';
    const colorText3 = style.getPropertyValue('--text3').trim() || '#404060';
    const colorBorder = style.getPropertyValue('--border2').trim() || 'rgba(255,255,255,0.10)';

    ctx.clearRect(0, 0, W, H);

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.t + (i / gridLines) * ch;
      const v = maxV - (i / gridLines) * range;
      ctx.strokeStyle = colorBorder;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = colorText3;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText((v >= 0 ? '+' : '') + '$' + Math.round(v).toLocaleString(), pad.l - 6, y + 4);
    }

    const zeroY = yOf(0);
    ctx.strokeStyle = colorBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    if (equity.length < 2) return;

    const lastVal = equity[equity.length - 1].value;
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
    if (lastVal >= 0) {
      grad.addColorStop(0, 'rgba(34,197,94,0.16)');
      grad.addColorStop(1, 'rgba(34,197,94,0.01)');
    } else {
      grad.addColorStop(0, 'rgba(239,68,68,0.01)');
      grad.addColorStop(1, 'rgba(239,68,68,0.16)');
    }

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(equity[0].value));
    for (let i = 1; i < equity.length; i++) {
      const x0 = xOf(i - 1), y0 = yOf(equity[i - 1].value);
      const x1 = xOf(i), y1 = yOf(equity[i].value);
      const mx = (x0 + x1) / 2;
      ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
    }
    ctx.lineTo(xOf(equity.length - 1), pad.t + ch);
    ctx.lineTo(xOf(0), pad.t + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(equity[0].value));
    for (let i = 1; i < equity.length; i++) {
      const x0 = xOf(i - 1), y0 = yOf(equity[i - 1].value);
      const x1 = xOf(i), y1 = yOf(equity[i].value);
      const mx = (x0 + x1) / 2;
      ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
    }
    ctx.strokeStyle = lastVal >= 0 ? colorBull : colorBear;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < equity.length; i++) {
      const x = xOf(i), y = yOf(equity[i].value);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = equity[i].value >= 0 ? colorBull : colorBear;
      ctx.fill();
    }

    const dateIdxs = [0, Math.floor(equity.length / 3), Math.floor(equity.length * 2 / 3), equity.length - 1]
      .filter((v, i, a) => a.indexOf(v) === i && v < equity.length);
    ctx.fillStyle = colorText3;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    for (const i of dateIdxs) ctx.fillText(equity[i].date.slice(5), xOf(i), H - 8);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => { cancelled = true; ro.disconnect(); };
  }, [equity]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ── Calendar ─────────────────────────────────────────────────────────────────
export function CalendarView({ byDay }) {
  const [current, setCurrent] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const { year, month } = current;
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - mondayOffset);

  const weeks = [];
  const cur = new Date(start);
  while (cur <= lastDay || weeks.length < 5) {
    const week = [];
    for (let d = 0; d < 5; d++) {
      const dateStr = cur.toISOString().slice(0, 10);
      const inMonth = cur.getMonth() === month;
      const pnl = byDay[dateStr];
      week.push({ date: dateStr, day: cur.getDate(), inMonth, pnl });
      cur.setDate(cur.getDate() + 1);
    }
    cur.setDate(cur.getDate() + 2);
    weeks.push(week);
    if (weeks.length >= 6) break;
  }

  const monthPnl = Object.entries(byDay)
    .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .reduce((s, [, v]) => s + v, 0);

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setCurrent(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', display: 'flex' }}
        ><Icon name="chevronL" size={14}/></button>
        <span style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>{monthName}</span>
        <button
          onClick={() => setCurrent(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', display: 'flex' }}
        ><Icon name="chevron" size={14}/></button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          Month total: <span style={{ color: monthPnl > 0 ? 'var(--bull)' : monthPnl < 0 ? 'var(--bear)' : 'var(--text2)', fontWeight: 600 }}>
            {monthPnl >= 0 ? '+' : ''}${monthPnl.toLocaleString()}
          </span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 4 }}>
        {dayHeaders.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 4 }}>
          {week.map(({ date, day, inMonth, pnl }) => {
            const hasTrade = pnl !== undefined;
            const isToday = date === new Date().toISOString().slice(0, 10);
            let bg = 'var(--surface)';
            let pnlColor = 'var(--text3)';
            if (hasTrade && inMonth) {
              bg = pnl > 0 ? 'var(--bullDim)' : pnl < 0 ? 'var(--bearDim)' : 'var(--beDim)';
              pnlColor = pnl > 0 ? 'var(--bull)' : pnl < 0 ? 'var(--bear)' : 'var(--be)';
            }
            return (
              <div key={date} style={{
                background: inMonth ? bg : 'transparent',
                border: `1px solid ${isToday ? 'var(--accentBorder)' : hasTrade && inMonth ? 'transparent' : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 6px', minHeight: 58,
                opacity: inMonth ? 1 : 0.3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.15s',
              }}>
                <div style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text2)', fontWeight: isToday ? 700 : 500, marginBottom: 4 }}>{day}</div>
                {hasTrade && inMonth ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: pnlColor }}>
                    {pnl > 0 ? '+' : ''}${Math.round(Math.abs(pnl)).toLocaleString()}
                  </div>
                ) : inMonth ? (
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>—</div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Model breakdown ───────────────────────────────────────────────────────────
function ModelBreakdown({ trades }) {
  const byModel = {};
  for (const t of trades) {
    const m = t.entryModel || 'Other';
    if (!byModel[m]) byModel[m] = { count: 0, wins: 0, pnl: 0 };
    byModel[m].count++;
    if (t.result === 'Win') byModel[m].wins++;
    byModel[m].pnl += Number(t.pnlDollars) || 0;
  }
  const rows = Object.entries(byModel).sort((a, b) => b[1].count - a[1].count);
  if (!rows.length) return <div style={{ color: 'var(--text3)', fontSize: 12, padding: 12 }}>No trades</div>;

  return (
    <div>
      {rows.map(([model, data]) => {
        const wr = ((data.wins / data.count) * 100).toFixed(0);
        const barW = Math.round((data.count / trades.length) * 100);
        return (
          <div key={model} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, gap: 12 }}>
              <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
              <span style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>
                <span>{data.count}T</span>
                <span style={{ color: parseInt(wr) >= 50 ? 'var(--bull)' : 'var(--bear)' }}>{wr}% WR</span>
                <span style={{ color: data.pnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{data.pnl >= 0 ? '+' : ''}${Math.round(data.pnl)}</span>
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${barW}%`, height: '100%', background: parseInt(wr) >= 50 ? 'var(--bull)' : 'var(--bear)', borderRadius: 2, transition: 'width 0.4s' }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Performance main ──────────────────────────────────────────────────────────
export default function Performance() {
  const [trades] = useState(() => Store.getTrades());
  const [tab, setTab] = useState('Overview');
  const [period, setPeriod] = useState('All');

  const filtered = useMemo(() => {
    if (period === 'All') return trades;
    const now = new Date();
    const cutoff = new Date();
    if (period === '7d') cutoff.setDate(now.getDate() - 7);
    else if (period === '30d') cutoff.setDate(now.getDate() - 30);
    else if (period === '90d') cutoff.setDate(now.getDate() - 90);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return trades.filter(t => t.date >= cutStr);
  }, [trades, period]);

  const stats = useMemo(() => calcStats(filtered), [filtered]);

  if (!stats) return <Empty icon="📈" title="No trade data yet" desc="Start journalling trades to see your performance metrics."/>;

  const fmtPnl = (v) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString()}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <Tabs tabs={['Overview', 'Calendar', 'Models', 'Equity']} active={tab} onChange={setTab}/>
        <div style={{ flex: 1 }}/>
        <Tabs tabs={['7d', '30d', '90d', 'All']} active={period} onChange={setPeriod}/>
      </div>

      {tab === 'Overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total P&L"
              value={<span style={{ color: stats.totalPnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{fmtPnl(stats.totalPnl)}</span>}/>
            <StatCard label="Win Rate" value={`${stats.winRate}%`}
              sub={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`}/>
            <StatCard label="Profit Factor" value={stats.profitFactor}
              sub={`G.Win $${Math.round(stats.grossWin)} / G.Loss $${Math.round(stats.grossLoss)}`}/>
            <StatCard label="Avg R Won" value={<span style={{ color: 'var(--bull)' }}>+{stats.avgRWin}R</span>}
              sub={`Avg R Lost: ${stats.avgRLoss}R`}/>
            <StatCard label="Max Drawdown" value={<span style={{ color: 'var(--bear)' }}>-${Math.round(stats.maxDD)}</span>}/>
            <StatCard label="Best Day" value={<span style={{ color: 'var(--bull)' }}>{fmtPnl(stats.bestDay)}</span>}
              sub={`Worst: ${fmtPnl(stats.worstDay)}`}/>
            <StatCard label="Rules Score" value={stats.avgRulesScore !== null ? `${stats.avgRulesScore}%` : '—'}
              color={stats.avgRulesScore >= 80 ? 'var(--bull)' : stats.avgRulesScore >= 60 ? 'var(--accent)' : 'var(--bear)'}/>
            <StatCard label="Current Streak"
              value={<span style={{ color: stats.streakType === 'Win' ? 'var(--bull)' : stats.streakType === 'Loss' ? 'var(--bear)' : 'var(--be)' }}>
                {stats.streak} {stats.streakType}
              </span>}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div className="card">
              <div className="card-title">Equity Curve</div>
              <div style={{ height: 200 }}>
                {stats.equity.length >= 2 ? <EquityCurve equity={stats.equity}/> : <div style={{ color: 'var(--text3)', fontSize: 12, padding: 20 }}>Need 2+ trades</div>}
              </div>
            </div>
            <div className="card">
              <div className="card-title">Entry Model Breakdown</div>
              <ModelBreakdown trades={filtered}/>
            </div>
          </div>
        </div>
      )}

      {tab === 'Calendar' && (
        <div className="card">
          <CalendarView byDay={stats.byDay}/>
        </div>
      )}

      {tab === 'Models' && (
        <div className="card">
          <div className="card-title">Entry Model Performance</div>
          <ModelBreakdown trades={filtered}/>
        </div>
      )}

      {tab === 'Equity' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 0 }}>Equity Curve — {filtered.length} trades</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
            Running cumulative P&L per trade ({period === 'All' ? 'all time' : `last ${period}`})
          </div>
          <div style={{ height: 360 }}>
            {stats.equity.length >= 2
              ? <EquityCurve equity={stats.equity}/>
              : <Empty icon="📈" title="Not enough data" desc="Log at least 2 trades to see the equity curve."/>}
          </div>
        </div>
      )}
    </div>
  );
}
