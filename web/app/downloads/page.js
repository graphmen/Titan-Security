import Link from 'next/link';
import {
  Shield,
  Download,
  UserCog,
  Star,
  Package,
  HardDrive,
  Layers,
  Monitor,
  Smartphone,
  RefreshCw,
  Globe,
  ArrowLeft,
} from 'lucide-react';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const metadata = {
  title: 'Mobile App Downloads — Titan Protection',
  description: 'Download Titan Monitor and Titan Supervisor Android apps for field operations.',
};

const APP_CATALOG = {
  monitor: {
    icon: Shield,
    badge: 'Guard field release',
    packageName: 'com.titan.monitor',
    integration: 'Patrol · GPS clock-in · SOS · NFC checkpoints',
    features:
      'Built for security guards on patrol — GPS attendance, distress alerts, incident logging, and NFC checkpoint scans sync live to Command Centre.',
    recommended: true,
  },
  supervisor: {
    icon: UserCog,
    badge: 'Supervisor field release',
    packageName: 'com.titan.supervisor',
    integration: 'Territories · Guards · Premises · Live alerts',
    features:
      'Built for area supervisors — manage guards and sites in assigned territories, respond to alerts, and mirror mobile actions on the web dashboard.',
    recommended: false,
  },
};

async function getApkFileMeta(apkFile) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'downloads', apkFile);
    const fileStat = await stat(filePath);
    const mb = fileStat.size / (1024 * 1024);
    return {
      available: true,
      sizeLabel: `${mb.toFixed(1)} MB`,
    };
  } catch {
    return {
      available: false,
      sizeLabel: 'Not published yet',
    };
  }
}

async function getApps() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'downloads', 'versions.json');
    const manifest = JSON.parse(await readFile(filePath, 'utf8'));
    const keys = ['monitor', 'supervisor'];
    const apps = await Promise.all(
      keys.map(async (key) => {
        const entry = manifest[key];
        const catalog = APP_CATALOG[key];
        const fileMeta = await getApkFileMeta(entry.apkFile);
        return {
          key,
          ...entry,
          ...catalog,
          ...fileMeta,
          icon: catalog.icon,
        };
      })
    );
    return { updatedAt: manifest.updatedAt, apps };
  } catch {
    return { updatedAt: null, apps: [] };
  }
}

export default async function DownloadsPage() {
  const { apps, updatedAt } = await getApps();

  return (
    <div className="releases-page">
      <header className="releases-hero">
        <div className="releases-hero-inner">
          <span className="releases-badge">System releases &amp; deployment</span>
          <h1>Mobile App Downloads &amp; System Ecosystem</h1>
          <p>
            Access the latest compiled Android APKs for Titan field officers and supervisors.
            Review how the web command portal and mobile clients stay in sync across your operation.
          </p>
          <div className="releases-hero-actions">
            <Link href="/" className="releases-back-link">
              <ArrowLeft size={16} /> Back to dashboard
            </Link>
            <Link href="/login" className="releases-back-link muted">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="releases-main">
        <div className="releases-grid">
          <section className="releases-column">
            <h2 className="releases-section-label">Compiled APK downloads</h2>

            <div className="releases-apk-list">
              {apps.map((app) => {
                const Icon = app.icon;
                const apkHref = `/downloads/${app.apkFile}`;
                return (
                  <article key={app.key} className="releases-apk-card">
                    <div className="releases-apk-card-head">
                      <div className="releases-apk-icon">
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3>{app.name}</h3>
                        <span className="releases-apk-badge">
                          {app.recommended && <Star size={12} />}
                          {app.badge}
                        </span>
                      </div>
                    </div>

                    <p className="releases-apk-desc">{app.features || app.description}</p>

                    <dl className="releases-meta-list">
                      <div className="releases-meta-row">
                        <dt><Package size={14} /> Package name</dt>
                        <dd>{app.apkFile}</dd>
                      </div>
                      <div className="releases-meta-row">
                        <dt><HardDrive size={14} /> File size</dt>
                        <dd>{app.sizeLabel}</dd>
                      </div>
                      <div className="releases-meta-row">
                        <dt><Layers size={14} /> Core integration</dt>
                        <dd>{app.integration}</dd>
                      </div>
                      <div className="releases-meta-row">
                        <dt><Shield size={14} /> Android package</dt>
                        <dd>{app.packageName}</dd>
                      </div>
                    </dl>

                    {app.available ? (
                      <a href={apkHref} className="releases-download-btn" download>
                        <Download size={18} />
                        Download APK (v{app.version})
                      </a>
                    ) : (
                      <div className="releases-download-pending">
                        APK v{app.version} is listed — build and publish with{' '}
                        <code>.\scripts\publish-mobile-apks.ps1</code>
                      </div>
                    )}

                    {app.notes && <p className="releases-apk-notes">{app.notes}</p>}
                  </article>
                );
              })}
            </div>

            <div className="releases-install-steps glass-panel">
              <h3><Smartphone size={18} /> Install &amp; in-app updates</h3>
              <ol>
                <li>Download the APK and open it on your Android device.</li>
                <li>Allow installation from this source when prompted.</li>
                <li>After install, the sign-in screen shows your version and an <strong>Update app</strong> button when a newer build is published.</li>
                <li>Tap update to download and replace the installed app — no manual reinstall needed.</li>
              </ol>
              {updatedAt && (
                <p className="releases-updated">Catalog updated: {new Date(updatedAt).toLocaleString()}</p>
              )}
            </div>
          </section>

          <section className="releases-column">
            <h2 className="releases-section-label">Ecosystem overview</h2>

            <div className="releases-ecosystem-card glass-panel">
              <h3><Globe size={18} /> Understanding the system components</h3>

              <ol className="releases-ecosystem-list">
                <li>
                  <span className="releases-eco-icon monitor"><Monitor size={18} /></span>
                  <div>
                    <strong>Master Admin Web Portal</strong>
                    <p>
                      Central command hub for administrators — register supervisors, guards, premises,
                      and territories. Command Centre receives live SOS, GPS clock-ins, patrol taps, and incidents.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="releases-eco-icon guard"><Smartphone size={18} /></span>
                  <div>
                    <strong>Titan Monitor (Guard mobile)</strong>
                    <p>
                      Field client for guards — PIN login, on-duty GPS tracking, SOS panic, visitor logs,
                      and NFC patrol checkpoints. Works against the same live server as the web dashboard.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="releases-eco-icon supervisor"><UserCog size={18} /></span>
                  <div>
                    <strong>Titan Supervisor (Supervisor mobile &amp; web)</strong>
                    <p>
                      Territory-scoped operations for area supervisors — same 6-digit PIN on mobile and web.
                      Manage guards and premises only within assigned territories.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="releases-eco-icon sync"><RefreshCw size={18} /></span>
                  <div>
                    <strong>Seamless sync bridge</strong>
                    <p>
                      All clients read and write through the Titan API — mobile clock-ins, alerts, and patrol
                      events appear in Command Centre within seconds. OTA updates keep field apps current without IT reinstalls.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
