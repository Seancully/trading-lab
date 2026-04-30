import { effectivePnl } from './store.js';

// Compute aggregated stats for a set of trades.
// `accountFilter` weights each trade by the contracts on the selected accounts
// (null = all accounts on the trade contribute).
export function calcStats(trades, accountFilter = null) {
  if (!trades.length) return null;
  const eff = (t) => effectivePnl(t, accountFilter);

  const wins = trades.filter(t => t.result === 'Win');
  const losses = trades.filter(t => t.result === 'Loss');
  const bes = trades.filter(t => t.result === 'BE');

  const totalPnl = trades.reduce((s, t) => s + eff(t), 0);
  const grossWin = wins.reduce((s, t) => s + eff(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + eff(t), 0));
  const profitFactor = grossLoss === 0 ? grossWin > 0 ? '∞' : '—' : (grossWin / grossLoss).toFixed(2);
  const winRate = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : 0;
  const avgRWin = wins.length ? (wins.reduce((s, t) => s + (Number(t.rMultiple) || 0), 0) / wins.length).toFixed(2) : 0;
  const avgRLoss = losses.length ? (losses.reduce((s, t) => s + (Number(t.rMultiple) || 0), 0) / losses.length).toFixed(2) : 0;
  const scored = trades.filter(t => t.rulesScore > 0);
  const avgRulesScore = scored.length
    ? Math.round(scored.reduce((s, t) => s + t.rulesScore, 0) / scored.length)
    : null;

  let peak = 0, running = 0, maxDD = 0;
  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const t of sorted) {
    running += eff(t);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  const byDay = {};
  for (const t of trades) {
    if (!t.date) continue;
    byDay[t.date] = (byDay[t.date] || 0) + eff(t);
  }
  const dayVals = Object.values(byDay);
  const bestDay = dayVals.length ? Math.max(...dayVals) : 0;
  const worstDay = dayVals.length ? Math.min(...dayVals) : 0;

  let streak = 0, streakType = 'Win';
  const byDate = [...trades].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (byDate.length) {
    streakType = byDate[0].result;
    for (const t of byDate) {
      if (t.result === streakType) streak++;
      else break;
    }
  }

  let cum = 0;
  const equity = sorted.map(t => { cum += eff(t); return { date: t.date, value: cum }; });

  // Per-metric rolling series (one point per trade, in chronological order)
  // — used to drive metric-specific sparklines on the dashboard. Each card
  // gets a line that actually reflects its own number's history rather than
  // re-tinting the equity curve.
  const series = (() => {
    const winRate = [], pf = [], avgRWin = [], dd = [], rules = [];
    let w = 0, l = 0, b = 0;
    let gw = 0, gl = 0;
    let rWinSum = 0, rWinN = 0;
    let peakRun = 0, run = 0;
    let rulesSum = 0, rulesN = 0;
    for (const t of sorted) {
      if (t.result === 'Win') w++;
      else if (t.result === 'Loss') l++;
      else if (t.result === 'BE') b++;
      const total = w + l + b;
      winRate.push(total ? (w / total) * 100 : 0);

      const e = eff(t);
      if (t.result === 'Win') gw += e;
      if (t.result === 'Loss') gl += Math.abs(e);
      pf.push(gl === 0 ? (gw > 0 ? gw : 0) : gw / gl);

      if (t.result === 'Win') { rWinSum += Number(t.rMultiple) || 0; rWinN++; }
      avgRWin.push(rWinN ? rWinSum / rWinN : 0);

      run += e;
      if (run > peakRun) peakRun = run;
      dd.push(peakRun - run);

      if (t.rulesScore > 0) { rulesSum += t.rulesScore; rulesN++; }
      rules.push(rulesN ? rulesSum / rulesN : 0);
    }
    return { winRate, pf, avgRWin, dd, rules };
  })();

  return {
    total: trades.length, wins: wins.length, losses: losses.length, bes: bes.length,
    totalPnl, grossWin, grossLoss, profitFactor, winRate, avgRWin, avgRLoss,
    avgRulesScore, maxDD, bestDay, worstDay, streak, streakType, equity, byDay,
    series,
  };
}
