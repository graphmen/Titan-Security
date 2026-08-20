'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

/** Isolates Leaflet map failures so the rest of the dashboard keeps working. */
export default class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PremisesMapPanel]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', minHeight: this.props.minHeight || 420 }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>GIS map could not load</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', maxWidth: 420, margin: '0 auto 1rem' }}>
            A map rendering error occurred. Other dashboard tabs are still available.
          </p>
          <button type="button" className="btn-primary" onClick={this.handleRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} /> Retry map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
