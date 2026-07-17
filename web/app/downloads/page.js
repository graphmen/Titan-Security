import Link from 'next/link';
import { Shield, Smartphone, Download, UserCog } from 'lucide-react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const metadata = {
  title: 'Download Mobile Apps — Titan Protection',
  description: 'Download Titan Monitor and Titan Supervisor Android apps.',
};

async function getApps() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'downloads', 'versions.json');
    const manifest = JSON.parse(await readFile(filePath, 'utf8'));
    return {
      updatedAt: manifest.updatedAt,
      apps: [
        { key: 'monitor', ...manifest.monitor, icon: Shield },
        { key: 'supervisor', ...manifest.supervisor, icon: UserCog },
      ],
    };
  } catch {
    return { updatedAt: null, apps: [] };
  }
}

export default async function DownloadsPage() {
  const { apps, updatedAt } = await getApps();

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide downloads-page">
        <div className="auth-brand">
          <img src="/emblem-wordmark.png" alt="Titan Protection" className="auth-logo" />
          <h1>Mobile Apps</h1>
          <p>Download Titan Android apps for guards and supervisors. Install once, then use in-app updates for new versions.</p>
        </div>

        <div className="auth-role-grid">
          {apps.map((app) => {
            const Icon = app.icon;
            const apkHref = `/downloads/${app.apkFile}`;
            return (
              <div key={app.key} className="auth-role-card downloads-card">
                <div className={`auth-role-icon ${app.key === 'monitor' ? 'admin' : 'supervisor'}`}>
                  <Icon size={28} />
                </div>
                <h2>{app.name}</h2>
                <p>{app.description}</p>
                <p className="downloads-meta">
                  Version <strong>{app.version}</strong>
                  {app.notes ? ` · ${app.notes}` : ''}
                </p>
                <a href={apkHref} className="btn-primary downloads-btn" download>
                  <Download size={16} /> Download APK
                </a>
              </div>
            );
          })}
        </div>

        <div className="downloads-help">
          <h3><Smartphone size={18} /> Install &amp; update</h3>
          <ol>
            <li>Download the APK and open it on your Android phone.</li>
            <li>Allow installation from this source if Android asks.</li>
            <li>After the first install, open the app — version info and an <strong>Update</strong> button appear on the sign-in screen.</li>
            <li>When a new version is published, tap <strong>Update</strong> to download and install without reinstalling manually.</li>
          </ol>
          {updatedAt && (
            <p className="downloads-updated">Catalog last updated: {new Date(updatedAt).toLocaleString()}</p>
          )}
          <p className="auth-hint" style={{ marginTop: '1rem' }}>
            <Link href="/login">← Back to web sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
