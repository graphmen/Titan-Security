import Link from 'next/link';
import { Shield, UserCog } from 'lucide-react';

export const metadata = {
  title: 'Sign In — Titan Protection',
};

export default function LoginChooserPage() {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <img src="/emblem-wordmark.png" alt="Titan Protection" className="auth-logo" />
          <h1>Welcome to Titan Protection</h1>
          <p>Choose how you want to sign in to the operations platform.</p>
        </div>

        <div className="auth-role-grid">
          <Link href="/admin/login" className="auth-role-card">
            <div className="auth-role-icon admin">
              <Shield size={28} />
            </div>
            <h2>Master Admin</h2>
            <p>Full access — manage supervisors, territories, guards, premises, and system settings.</p>
            <span className="auth-role-cta">Admin sign in →</span>
          </Link>

          <Link href="/supervisor/login" className="auth-role-card">
            <div className="auth-role-icon supervisor">
              <UserCog size={28} />
            </div>
            <h2>Supervisor</h2>
            <p>Area-scoped access — command centre, guards, and premises in your assigned territories only.</p>
            <span className="auth-role-cta">Supervisor sign in →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
