import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, effectivePnl } from '../lib/store.js';
import { calcStats } from '../lib/stats.js';
import { Tabs, StatCard, Empty, Icon, Badge, DirBadge, PnlText, Btn, GradeBadge, GRADES, GRADE_META } from '../components/Shared.jsx';
import { toast } from '../lib/toast.js';

// ── Equity curve canvas ───────────────────────────────────────────────────────
export function EquityCurve({ equity }) {
  const canvasRef = useRef();
  const pointsRef = useRef([]);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);

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

      const points = equity.map((p, i) => {
        const x = xOf(i);
        const y = yOf(p.value);
        const prev = i === 0 ? 0 : equity[i - 1].value;
        return { x, y, date: p.date, value: p.value, delta: p.value - prev };
      });
      pointsRef.current = points;

      for (let i = 0; i < points.length; i++) {
        const { x, y, value } = points[i];
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = value >= 0 ? colorBull : colorBear;
        ctx.fill();
      }

      if (hoverIdx !== null && points[hoverIdx]) {
        const { x, y, delta } = points[hoverIdx];
        ctx.strokeStyle = delta >= 0 ? colorBull : colorBear;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }

      const dateIdxs = [0, Math.floor(equity.length / 3), Math.floor(equity.length * 2 / 3), equity.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i && v < equity.length);
      ctx.fillStyle = colorText3;
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      for (const i of dateIdxs) ctx.fillText((equity[i].date || '').slice(5), xOf(i), H - 8);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => { cancelled = true; ro.disconnect(); };
  }, [equity, hoverIdx]);

  useEffect(() => {
    if (hoverIdx === null) { setHoverPoint(null); return; }
    const point = pointsRef.current[hoverIdx];
    setHoverPoint(point || null);
  }, [hoverIdx, equity]);

  // Reusable hit-test against nearest data point, given canvas-space coords.
  const hitTest = (cx, cy, hitRadius = 8) => {
    const points = pointsRef.current;
    if (!points.length) return -1;
    let nearest = -1;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - cx;
      const dy = points[i].y - cy;
      const dist = dx * dx + dy * dy;
      if (dist < best) { best = dist; nearest = i; }
    }
    return best <= hitRadius * hitRadius ? nearest : -1;
  };

  const handleMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const idx = hitTest(e.clientX - rect.left, e.clientY - rect.top, 8);
    if (idx >= 0) {
      if (hoverIdx !== idx) setHoverIdx(idx);
    } else if (hoverIdx !== null) {
      setHoverIdx(null);
    }
  };

  // Touch: a tap pins the nearest point's tooltip. Tapping elsewhere on the
  // canvas (or anywhere outside) dismisses it.
  const handleTouch = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = e.touches?.[0] || e.changedTouches?.[0];
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    const idx = hitTest(t.clientX - rect.left, t.clientY - rect.top, 22); // bigger touch hit
    setHoverIdx(idx >= 0 ? idx : null);
  };
  useEffect(() => {
    if (hoverIdx === null) return;
    const off = (e) => {
      const canvas = canvasRef.current;
      if (canvas && canvas.contains(e.target)) return;
      setHoverIdx(null);
    };
    document.addEventListener('touchstart', off, { passive: true });
    return () => document.removeEventListener('touchstart', off);
  }, [hoverIdx]);

  const delta = hoverPoint?.delta ?? 0;
  const kind = delta > 0 ? 'win' : delta < 0 ? 'loss' : 'be';
  const label = delta > 0 ? 'P' : delta < 0 ? 'L' : 'BE';
  const amount = delta === 0
    ? '$0'
    : `${delta > 0 ? '+' : '-'}$${Math.round(Math.abs(delta)).toLocaleString()}`;

  return (
    <div className="equity-wrap">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'pan-y' }}
      />
      {hoverPoint && (
        <div className={`equity-tooltip ${kind}`} style={{ left: hoverPoint.x, top: hoverPoint.y }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="tag">{label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{amount}</span>
          </div>
          <div className="meta">{hoverPoint.date}</div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────
export function CalendarView({ byDay, trades = [], accountFilter = null }) {
  const [current, setCurrent] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const tradesByDay = useMemo(() => {
    const map = {};
    for (const t of trades) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    Object.values(map).forEach(list => {
      list.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    });
    return map;
  }, [trades]);
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
      // Local YYYY-MM-DD — toISOString() is UTC and shifts the date for any
      // timezone offset from UTC, which mismatched trade.date strings stored
      // as local dates and made each day's P&L appear in the wrong column.
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d2 = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d2}`;
      const inMonth = cur.getMonth() === month;
      const pnl = byDay[dateStr];
      week.push({ date: dateStr, day: cur.getDate(), inMonth, pnl });
      cur.setDate(cur.getDate() + 1);
    }
    cur.setDate(cur.getDate() + 2);
    weeks.push(week);
    if (weeks.length >= 6) break;
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthByDay = Object.entries(byDay).filter(([d]) => d.startsWith(monthPrefix));
  const monthPnl = monthByDay.reduce((s, [, v]) => s + v, 0);
  const monthTradeCount = trades.filter(t => (t.date || '').startsWith(monthPrefix)).length;
  const monthWins = trades.filter(t => (t.date || '').startsWith(monthPrefix) && t.result === 'Win').length;
  const monthLosses = trades.filter(t => (t.date || '').startsWith(monthPrefix) && t.result === 'Loss').length;
  const monthBestDay = monthByDay.length ? Math.max(...monthByDay.map(([, v]) => v)) : 0;
  const monthWorstDay = monthByDay.length ? Math.min(...monthByDay.map(([, v]) => v)) : 0;
  const monthTradedDays = monthByDay.filter(([, v]) => v !== 0).length;
  // Intensity anchor for calendar shading — best profit day = full green, scaled down from there.
  const maxPosPnl = Math.max(...monthByDay.map(([, v]) => v).filter(v => v > 0), 1);
  const maxNegPnl = Math.abs(Math.min(...monthByDay.map(([, v]) => v).filter(v => v < 0), -1));

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const fmtDay = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const openTrade = (id) => {
    window.dispatchEvent(new CustomEvent('tl:openTrade', { detail: { id } }));
  };

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setCurrent(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', display: 'flex' }}
        ><Icon name="chevronL" size={14}/></button>
        <span style={{ fontWeight: 700, fontSize: 15, minWidth: 150, textAlign: 'center' }}>{monthName}</span>
        <button
          onClick={() => setCurrent(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', display: 'flex' }}
        ><Icon name="chevron" size={14}/></button>
        <div style={{ flex: 1 }}/>
        {monthTradeCount > 0 ? (
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--mono)' }}>
            <CalHeaderStat label="Total" value={`${monthPnl >= 0 ? '+' : '-'}$${Math.abs(Math.round(monthPnl)).toLocaleString()}`}
              color={monthPnl > 0 ? 'var(--bull)' : monthPnl < 0 ? 'var(--bear)' : 'var(--text2)'}/>
            <CalHeaderStat label="Trades" value={`${monthTradeCount}`} sub={`${monthWins}W · ${monthLosses}L`}/>
            <CalHeaderStat label="Days" value={`${monthTradedDays}`} sub="traded"/>
            <CalHeaderStat label="Best day" value={`+$${Math.round(monthBestDay).toLocaleString()}`} color="var(--bull)"/>
            <CalHeaderStat label="Worst day" value={`-$${Math.round(Math.abs(monthWorstDay)).toLocaleString()}`} color="var(--bear)"/>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>No trades this month</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 4 }}>
        {dayHeaders.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 4 }}>
          {week.map(({ date, day, inMonth, pnl }) => {
            const dayTrades = tradesByDay[date] || [];
            const hasTrade = dayTrades.length > 0;
            const isToday = date === todayStr;
            let bg = 'var(--surface)';
            let pnlColor = 'var(--text3)';
            if (hasTrade && inMonth) {
              if (pnl > 0) {
                const intensity = Math.min(pnl / maxPosPnl, 1);
                const alpha = (0.08 + 0.22 * intensity).toFixed(3);
                bg = `rgba(34,197,94,${alpha})`;
              } else if (pnl < 0) {
                const intensity = Math.min(Math.abs(pnl) / maxNegPnl, 1);
                const alpha = (0.08 + 0.18 * intensity).toFixed(3);
                bg = `rgba(244,63,94,${alpha})`;
              } else {
                bg = 'var(--beDim)';
              }
              pnlColor = pnl > 0 ? 'var(--bull)' : pnl < 0 ? 'var(--bear)' : 'var(--be)';
            }
            return (
              <div
                key={date}
                className={`calendar-cell ${inMonth ? 'in-month' : 'out-month'} ${isToday ? 'today' : ''} ${hasTrade ? 'has-trade' : ''}`}
                style={{
                  background: inMonth ? bg : 'transparent',
                  border: `1px solid ${isToday ? 'var(--accentBorder)' : hasTrade && inMonth ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 8, padding: '8px 6px', minHeight: 58,
                  opacity: inMonth ? 1 : 0.3,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 0.15s',
                }}
                role={inMonth ? 'button' : undefined}
                tabIndex={inMonth ? 0 : -1}
                onClick={() => { if (inMonth) setSelectedDay({ date, trades: dayTrades }); }}
                onKeyDown={(e) => {
                  if (!inMonth) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDay({ date, trades: dayTrades }); }
                }}
              >
                <div style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text2)', fontWeight: isToday ? 700 : 500, marginBottom: 4 }}>{day}</div>
                {hasTrade && inMonth ? (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: pnlColor }}>
                    {pnl > 0 ? '+' : ''}${Math.round(Math.abs(pnl)).toLocaleString()}
                  </div>
                ) : inMonth ? (
                  <div title="No trades" style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'var(--border2)', opacity: 0.6,
                  }}/>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {selectedDay && (
        <>
          <div className="calendar-drawer-backdrop" onClick={() => setSelectedDay(null)} />
          <div className="calendar-drawer">
            <div className="calendar-drawer-head">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Day preview</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDay(selectedDay.date)}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedDay(null)} title="Close">
                <Icon name="x" size={12}/>
              </button>
            </div>
            <div className="calendar-drawer-body">
              {selectedDay.trades.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '6px 0' }}>No trades logged for this day.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDay.trades.map(trade => (
                    <div key={trade.id} className="calendar-trade-row">
                      <Badge result={trade.result}/>
                      <DirBadge dir={trade.direction}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {trade.entryModel || 'Trade'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {trade.instrument}{trade.time ? ` · ${trade.time}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PnlText value={effectivePnl(trade, accountFilter)} size={13}/>
                        <Btn size="sm" variant="ghost" onClick={() => openTrade(trade.id)}>Open in Journal</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Model breakdown ───────────────────────────────────────────────────────────
function ModelBreakdown({ trades, accountFilter }) {
  const byModel = {};
  for (const t of trades) {
    const m = t.entryModel || 'Other';
    if (!byModel[m]) byModel[m] = { count: 0, wins: 0, pnl: 0 };
    byModel[m].count++;
    if (t.result === 'Win') byModel[m].wins++;
    byModel[m].pnl += effectivePnl(t, accountFilter);
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

function EquityCard({ title, subtitle, equity = [], height, empty, totalPnl, maxDD }) {
  const wrapRef = useRef();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) document.exitFullscreen();
    else el.requestFullscreen();
  };

  return (
    <div ref={wrapRef} className="card equity-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Icon name={isFullscreen ? 'shrink' : 'expand'} size={14}/>
        </button>
      </div>
      {subtitle && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{subtitle}</div>
      )}
      {isFullscreen && (
        <div className="equity-overlay">
          <div className="equity-overlay-item">
            <span>Total P&L</span>
            <strong style={{ color: totalPnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              {totalPnl >= 0 ? '+' : '-'}${Math.round(Math.abs(totalPnl)).toLocaleString()}
            </strong>
          </div>
          <div className="equity-overlay-item">
            <span>Max DD</span>
            <strong style={{ color: 'var(--bear)' }}>-${Math.round(maxDD).toLocaleString()}</strong>
          </div>
        </div>
      )}
      <div className="equity-chart" style={isFullscreen ? { flex: 1, minHeight: 220 } : { height }}>
        {equity.length >= 2 ? <EquityCurve equity={equity}/> : empty}
      </div>
    </div>
  );
}

function CalHeaderStat({ label, value, sub, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', fontFamily: 'var(--font)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text)' }}>{value}{sub ? <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text3)', marginLeft: 5, fontFamily: 'var(--font)' }}>{sub}</span> : null}</div>
    </div>
  );
}

// ── Weekly lessons ────────────────────────────────────────────────────────────
// Local Mon 00:00 → next Mon 00:00. Rolls over Monday morning automatically.
function startOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();             // 0=Sun..6=Sat
  const offset = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - offset);
  return d;
}
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtLessonDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function WeeklyLessons({ trades }) {
  const lessons = useMemo(() => {
    const start = localDateStr(startOfThisWeek());
    return trades
      .filter(t => (t.lesson || '').trim() && (t.date || '') >= start)
      .sort((a, b) => {
        const ad = (a.date || '') + ' ' + (a.time || '');
        const bd = (b.date || '') + ' ' + (b.time || '');
        return bd.localeCompare(ad);
      });
  }, [trades]);

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div className="card-title" style={{ margin: 0 }}>Lessons This Week</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Mon–Sun · {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
          </div>
          <Btn variant="ghost" size="sm" onClick={async () => {
            try { await navigator.clipboard.writeText(Store.exportWeekForClaude()); toast.success('Week data copied · paste into Claude with trade screenshots'); }
            catch { toast.error('Could not copy to clipboard'); }
          }}>
            <Icon name="upload" size={12}/>Copy week for Claude
          </Btn>
        </div>
      </div>
      {lessons.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 4px' }}>
          No lessons yet this week. Add a key takeaway when you review a trade and it'll show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lessons.map(t => {
            const resultColor = t.result === 'Win' ? 'var(--bull)' : t.result === 'Loss' ? 'var(--bear)' : 'var(--text3)';
            return (
              <div key={t.id} style={{
                padding: '10px 12px',
                borderLeft: `2px solid ${resultColor}`,
                background: 'var(--bg2)',
                borderRadius: 4,
              }}>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {t.lesson.trim()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{fmtLessonDate(t.date)}</span>
                  {t.entryModel && <span>· {t.entryModel}</span>}
                  {t.result && <span style={{ color: resultColor }}>· {t.result}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Most-skipped rules this week ──────────────────────────────────────────────
// Counts how many of this week's trades had each rule unchecked. Rules are
// considered "applicable" only if at least one trade this week explicitly
// engaged with the checklist (rulesScore > 0) — that way you don't get junk
// counts from trades logged before the rules feature existed.
function MostSkippedRules({ trades }) {
  const rulesData = useMemo(() => Store.getRules() || [], []);

  const skipped = useMemo(() => {
    const start = localDateStr(startOfThisWeek());
    const weekTrades = trades.filter(t => (t.date || '') >= start && (t.rulesScore || 0) > 0);
    if (!weekTrades.length) return { items: [], totalTrades: 0 };

    const allRules = rulesData.flatMap(cat => cat.rules.map(r => ({ ...r, category: cat.category })));
    const counts = {};
    for (const r of allRules) counts[r.id] = { rule: r, skipped: 0 };
    for (const t of weekTrades) {
      const checks = t.rulesChecklist || {};
      for (const r of allRules) {
        if (!checks[r.id]) counts[r.id].skipped++;
      }
    }
    const items = Object.values(counts)
      .filter(x => x.skipped > 0)
      .sort((a, b) => b.skipped - a.skipped)
      .slice(0, 5);
    return { items, totalTrades: weekTrades.length };
  }, [trades, rulesData]);

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>Discipline · Most-Skipped Rules</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {skipped.totalTrades > 0
            ? `This week · ${skipped.totalTrades} trade${skipped.totalTrades === 1 ? '' : 's'} scored`
            : 'This week'}
        </div>
      </div>
      {skipped.items.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 4px' }}>
          {skipped.totalTrades === 0
            ? 'No rules-scored trades this week yet. Tick the checklist when logging to see what you slip on most.'
            : 'Clean week — every rule on every trade. Keep it going.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {skipped.items.map(({ rule, skipped: count }) => {
            const pct = (count / skipped.totalTrades) * 100;
            const tone = pct >= 66 ? 'var(--bear)' : pct >= 33 ? 'var(--accent)' : 'var(--text3)';
            return (
              <div key={rule.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>
                      {rule.category}
                    </span>
                    {rule.text}
                  </div>
                  <div style={{ fontSize: 11, color: tone, fontFamily: 'var(--mono)', flexShrink: 0 }}>
                    {count}/{skipped.totalTrades}
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: tone, transition: 'width 0.3s ease' }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Grade breakdown ───────────────────────────────────────────────────────────
function GradeBreakdown({ trades, accountFilter }) {
  const data = useMemo(() => {
    const out = {};
    for (const g of GRADES) out[g] = { count: 0, wins: 0, losses: 0, bes: 0, pnl: 0, r: 0 };
    for (const t of trades) {
      const g = t.grade;
      if (!g || !out[g]) continue;
      out[g].count++;
      out[g].pnl += effectivePnl(t, accountFilter);
      out[g].r   += Number(t.rMultiple) || 0;
      if (t.result === 'Win')  out[g].wins++;
      else if (t.result === 'Loss') out[g].losses++;
      else out[g].bes++;
    }
    return out;
  }, [trades, accountFilter]);

  const totalGraded = GRADES.reduce((s, g) => s + data[g].count, 0);
  const totalTrades = trades.length;
  const gradedPct = totalTrades ? Math.round((totalGraded / totalTrades) * 100) : 0;

  if (!totalGraded) return (
    <div style={{ color: 'var(--text3)', fontSize: 12, padding: '24px 4px', textAlign: 'center' }}>
      No graded trades yet. Open any trade card → Review tab to assign a grade, or hover a card for the quick-grade bar.
    </div>
  );

  const fmtPnl = (v) => `${v >= 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {GRADES.map(g => {
          const d = data[g];
          if (!d.count) return null;
          const m = GRADE_META[g];
          const wr = Math.round((d.wins / d.count) * 100);
          const avgR = (d.r / d.count).toFixed(2);
          return (
            <div key={g} style={{
              flex: 1, minWidth: 120,
              border: `1.5px solid ${m.border}`,
              background: m.bg, borderRadius: 10, padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <GradeBadge grade={g} size="lg"/>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{d.count}T</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 2 }}>Win Rate</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15,
                    color: wr >= 50 ? 'var(--bull)' : 'var(--bear)' }}>{wr}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 2 }}>Avg R</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15,
                    color: Number(avgR) >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                    {Number(avgR) > 0 ? '+' : ''}{avgR}R
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 2 }}>Total P&L</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15,
                    color: d.pnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{fmtPnl(d.pnl)}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {d.wins}W · {d.losses}L{d.bes > 0 ? ` · ${d.bes}BE` : ''}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
        {totalGraded} of {totalTrades} trades graded ({gradedPct}%)
      </div>
    </div>
  );
}

// ── Performance main ──────────────────────────────────────────────────────────
export default function Performance({ accountFilter }) {
  const [allTrades] = useState(() => Store.getTrades());
  const [tab, setTab] = useState('Overview');
  const [period, setPeriod] = useState('All');

  const trades = useMemo(() => {
    if (accountFilter == null) return allTrades;
    if (Array.isArray(accountFilter) && !accountFilter.length) return [];
    return allTrades.filter(t => t.accounts?.some(a => accountFilter.includes(a.name)));
  }, [allTrades, accountFilter]);

  const filtered = useMemo(() => {
    if (period === 'All') return trades;
    const now = new Date();
    const cutoff = new Date();
    if (period === '7d') cutoff.setDate(now.getDate() - 7);
    else if (period === '30d') cutoff.setDate(now.getDate() - 30);
    else if (period === '90d') cutoff.setDate(now.getDate() - 90);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return trades.filter(t => (t.date || '') >= cutStr);
  }, [trades, period]);

  const stats = useMemo(() => calcStats(filtered, accountFilter), [filtered, accountFilter]);

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
          <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text3)' }}>P&L · Outcome</div>
          {/* Green glow behind the whole P&L row — colour comes through the glass */}
          <div className="card-glow-wrap" style={{ '--card-glow': stats.totalPnl >= 0 ? 'rgba(34,197,94,0.36)' : 'rgba(244,63,94,0.36)', marginBottom: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard label="Total P&L"
                value={<span style={{ color: stats.totalPnl >= 0 ? 'var(--bull)' : 'var(--bear)' }}>{fmtPnl(stats.totalPnl)}</span>}/>
              <StatCard label="Win Rate" value={`${stats.winRate}%`}
                sub={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`}/>
              <StatCard label="Profit Factor" value={stats.profitFactor}
                sub={`G.Win $${Math.round(stats.grossWin)} / G.Loss $${Math.round(stats.grossLoss)}`}/>
              <StatCard label="Avg R Won" value={<span style={{ color: 'var(--bull)' }}>+{stats.avgRWin}R</span>}
                sub={`Avg R Lost: ${stats.avgRLoss}R`}/>
            </div>
          </div>

          <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text3)' }}>Risk · Discipline</div>
          {/* Red/green glow behind discipline row */}
          <div className="card-glow-wrap" style={{ '--card-glow': 'rgba(244,63,94,0.28)', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }} className="perf-equity-models">
            <div className="card-glow-wrap" style={{ '--card-glow': stats.totalPnl >= 0 ? 'rgba(34,197,94,0.32)' : 'rgba(244,63,94,0.32)' }}>
              <EquityCard
                title="Equity Curve"
                equity={stats.equity}
                height={240}
                totalPnl={stats.totalPnl}
                maxDD={stats.maxDD}
                empty={<div style={{ color: 'var(--text3)', fontSize: 12, padding: 20 }}>Need 2+ trades</div>}
              />
            </div>
            <div className="card-glow-wrap" style={{ '--card-glow': 'rgba(122,162,247,0.28)' }}>
              <div className="card">
                <div className="card-title">Entry Model Breakdown</div>
                <ModelBreakdown trades={filtered} accountFilter={accountFilter}/>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Grade Breakdown — Execution Quality</div>
            <GradeBreakdown trades={filtered} accountFilter={accountFilter}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
            <WeeklyLessons trades={trades}/>
            <MostSkippedRules trades={trades}/>
          </div>
        </div>
      )}

      {tab === 'Calendar' && (
        <div className="card">
          <CalendarView byDay={stats.byDay} trades={filtered} accountFilter={accountFilter}/>
        </div>
      )}

      {tab === 'Models' && (
        <div className="card">
          <div className="card-title">Entry Model Performance</div>
          <ModelBreakdown trades={filtered} accountFilter={accountFilter}/>
        </div>
      )}

      {tab === 'Equity' && (
        <EquityCard
          title={`Equity Curve — ${filtered.length} trades`}
          subtitle={`Running cumulative P&L per trade (${period === 'All' ? 'all time' : `last ${period}`})`}
          equity={stats.equity}
          height={360}
          totalPnl={stats.totalPnl}
          maxDD={stats.maxDD}
          empty={<Empty icon="📈" title="Not enough data" desc="Log at least 2 trades to see the equity curve."/>}
        />
      )}
    </div>
  );
}
