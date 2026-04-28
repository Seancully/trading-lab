import { useState } from 'react';
import { Sync } from '../lib/store.js';
import { supabaseConfigured } from '../lib/supabase.js';

export default function Login({ onAuth, onLocalOnly }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const result = mode === 'signin'
      ? await Sync.signIn(email, password)
      : await Sync.signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === 'signup' && result.needsConfirm) {
      setSuccess('Check your email for a confirmation link, then sign in.');
      setMode('signin');
    } else if (result.user) {
      Sync.setUser(result.user);
      await Sync.syncAll();
      onAuth(result.user);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email above first.'); return; }
    setError(''); setSuccess(''); setLoading(true);
    const r = await Sync.resetPassword(email);
    setLoading(false);
    if (r.error) setError(r.error);
    else setSuccess('Password reset link sent — check your email.');
  };

  return (
    <div style={loginWrap}>
      <div style={loginCard}>
        <Logo />

        <div style={{ marginBottom: 28 }}>
          <div style={loginTitle}>{mode === 'signin' ? 'Welcome back' : 'Create account'}</div>
          <div style={loginSub}>
            {mode === 'signin' ? 'Sign in to access your trades and journal across all devices.' : 'Start tracking your ICT trades — synced everywhere.'}
          </div>
        </div>

        {!supabaseConfigured && (
          <div style={{ ...errorMsg, marginBottom: 16 }}>
            Supabase isn't configured for this build. Cross-device sync is disabled.
          </div>
        )}

        <div style={tabRow}>
          <button style={{ ...tabBtn, ...(mode === 'signin' ? tabActive : {}) }} onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}>Sign in</button>
          <button style={{ ...tabBtn, ...(mode === 'signup' ? tabActive : {}) }} onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Sign up</button>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Email</label>
            <input style={fieldInput} type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              autoComplete="email" />
          </div>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Password</label>
            <input style={fieldInput} type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6} />
          </div>

          {error   && <div style={errorMsg}>{error}</div>}
          {success && <div style={successMsg}>{success}</div>}

          <button type="submit" style={{ ...btnPrimary, marginTop: 4 }} disabled={loading || !supabaseConfigured}>
            {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>

          {mode === 'signin' && supabaseConfigured && (
            <button type="button" style={skipBtn} onClick={handleReset} disabled={loading}>
              Forgot password?
            </button>
          )}
        </form>

        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <button style={skipBtn} onClick={onLocalOnly}>
            Continue without login (local only — this device)
          </button>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wordmark)' }}>
        Trading Lab
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', marginTop: 3 }}>
        ICT · MNQ / MES
      </div>
    </div>
  );
}

const loginWrap = {
  height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: 20,
  backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(122,162,247,0.07) 0%, transparent 70%)',
};
const loginCard = {
  width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border2)',
  borderRadius: 16, padding: '36px 36px 32px',
  boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
};
const loginTitle = { fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 6 };
const loginSub   = { fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 };
const tabRow = {
  display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, padding: 3, marginBottom: 20, gap: 2,
};
const tabBtn = {
  flex: 1, padding: '6px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  border: 'none', background: 'none', color: 'var(--text3)', borderRadius: 6,
  fontFamily: 'var(--font)', transition: 'all 0.15s',
};
const tabActive = { background: 'var(--surface2)', color: 'var(--text)' };
const fieldWrap  = { display: 'flex', flexDirection: 'column', gap: 6 };
const fieldLabel = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text3)' };
const fieldInput = {
  background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8,
  color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, padding: '9px 12px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnPrimary = {
  width: '100%', padding: '10px 0', background: 'var(--text)', color: 'var(--bg)',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font)', letterSpacing: '-0.01em', transition: 'opacity 0.15s',
};
const skipBtn = {
  width: '100%', background: 'none', border: 'none', color: 'var(--text3)',
  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'center',
  padding: '6px 0',
};
const errorMsg   = { fontSize: 12, color: 'var(--bear)', background: 'var(--bearDim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px' };
const successMsg = { fontSize: 12, color: 'var(--bull)', background: 'var(--bullDim)', border: '1px solid rgba(34,197,94,0.2)',  borderRadius: 6, padding: '8px 12px' };
