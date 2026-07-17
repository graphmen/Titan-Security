'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/');
        router.refresh();
        return;
      }
      setError(json.error || 'Invalid email or password');
    } catch {
      setError('Cannot reach Titan server — check your connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/login" className="auth-back">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="auth-brand compact">
          <div className="auth-role-icon admin inline">
            <Shield size={24} />
          </div>
          <h1>Master Admin</h1>
          <p>Sign in with your administrator email and password.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" /> Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="auth-hint">
          Supervisors are registered by the Master Admin and sign in with their 6-digit PIN on the{' '}
          <Link href="/supervisor/login">supervisor login page</Link>.
        </p>
      </div>
    </div>
  );
}
