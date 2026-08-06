import { Component } from 'react'

// A class component — the one thing hooks still can't do. React only lets a
// CLASS catch render errors from its children (componentDidCatch has no hook
// equivalent), so this is the exception to the function-components rule.
//
// Without it, any exception thrown while rendering unmounts the entire tree
// and leaves a blank screen with the real error buried in the console. That
// is the worst failure mode in the app: it looks identical to a hang, a
// styling bug, or a crash, and tells you nothing.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[render error]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="container screen">
        <h1 className="readout" style={{ fontSize: 26, marginBottom: 'var(--space-4)' }}>SOMETHING BROKE</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
          This screen failed to render. Your logged data is safe — it's stored on this device and
          nothing here writes to it.
        </p>
        <pre className="error-dump">{String(this.state.error?.message ?? this.state.error)}</pre>
        <button className="btn btn-primary pressable btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={() => { this.setState({ error: null }); window.location.href = '/' }}>
          Back to today
        </button>
        <button className="btn btn-secondary pressable btn-block" style={{ marginTop: 'var(--space-2)' }} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
