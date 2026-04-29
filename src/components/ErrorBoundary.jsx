import React from 'react';

// Catches render-time errors anywhere in the subtree and shows a fallback
// the user can recover from, instead of an unmounted (black) screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Trading Lab crashed:', error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          maxWidth: 480, padding: '28px 32px',
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bear)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Something broke
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
            This view crashed while rendering.
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
            Your data is safe — it's stored locally and synced. The most common cause is a record with a missing field.
          </div>
          <pre style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--bear)',
            background: 'var(--bg)', border: '1px solid var(--border2)',
            padding: '8px 12px', borderRadius: 6, overflow: 'auto', maxHeight: 120,
            whiteSpace: 'pre-wrap', marginBottom: 18,
          }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={this.reset} className="btn btn-primary">Try again</button>
            <button onClick={() => window.location.reload()} className="btn btn-ghost">Reload page</button>
          </div>
        </div>
      </div>
    );
  }
}
