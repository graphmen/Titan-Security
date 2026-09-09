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
import { FALLBACK_MANIFEST, loadDownloadsManifest } from '../../lib/downloadsManifest';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'App Downloads — Titan Protection',
  description: 'Download Titan Monitor, Titan Supervisor, and the Windows desktop Command Centre client.',
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

async function getFileMeta(fileName) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'downloads', fileName);
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

async function getApkFileMeta(apkFile) {
  return getFileMeta(apkFile);
}

async function getDesktopMeta(manifest) {
  const entry = manifest.desktop || FALLBACK_MANIFEST.desktop;
  const portableMeta = await getFileMeta(entry.portableFile);
  const setupMeta = await getFileMeta(entry.setupFile);
  return {
    ...entry,
    portableMeta,
    setupMeta,
    available: portableMeta.available || setupMeta.available,
  };
}

async function getApps() {
  let manifest = FALLBACK_MANIFEST;
  try {
    manifest = await loadDownloadsManifest();
  } catch (err) {
    console.error('downloads manifest read failed, using fallback:', err);
  }

  const keys = ['monitor', 'supervisor'];
  const apps = await Promise.all(
    keys.map(async (key) => {
      const entry = manifest[key] || FALLBACK_MANIFEST[key];
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
  const desktop = await getDesktopMeta(manifest);
  return { updatedAt: manifest.updatedAt, apps, desktop };
}

export default async function DownloadsPage() {
  const { apps, updatedAt, desktop } = await getApps();

  return (
    <div className="releases-page">
      <header className="releases-hero">
        <div className="releases-hero-inner">
          <span className="releases-badge">System releases &amp; deployment</span>
          <h1>App Downloads &amp; System Ecosystem</h1>
          <p>
            Android APKs for field officers and supervisors, plus the Windows desktop Command Centre client.
            All clients connect to the same live Titan server.
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
                        <dt><Package size={14} /> APK file</dt>
                        <dd>{app.apkFile}</dd>
                      </div>
                      <div className="releases-meta-row">
                        <dt><Layers size={14} /> Version</dt>
                        <dd>v{app.version} (build {app.versionCode})</dd>
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
                      <a href={apkHref} className="releases-download-btn" download={app.apkFile}>
                        <Download size={18} />
                        Download APK (v{app.version})
                      </a>
                    ) : (
                      <a href={apkHref} className="releases-download-btn releases-download-btn-secondary" download={app.apkFile}>
                        <Download size={18} />
                        Download APK (v{app.version})
                      </a>
                    )}

                    {app.notes && (
                      <p className="releases-apk-notes"><strong>What&apos;s new:</strong> {app.notes}</p>
                    )}
                  </article>
                );
              })}
            </div>

            <h2 className="releases-section-label" style={{ marginTop: '1.5rem' }}>Windows desktop client</h2>
            <article className="releases-apk-card">
              <div className="releases-apk-card-head">
                <div className="releases-apk-icon">
                  <Monitor size={22} />
                </div>
                <div>
                  <h3>{desktop.name}</h3>
                  <span className="releases-apk-badge">Command Centre desktop</span>
                </div>
              </div>
              <p className="releases-apk-desc">
                Dedicated Windows app for Master Admin and supervisors — opens the live Command Centre in a
                focused window (no browser tabs). Same sign-in and data as the web dashboard.
              </p>
              <dl className="releases-meta-list">
                <div className="releases-meta-row">
                  <dt><Layers size={14} /> Version</dt>
                  <dd>v{desktop.version}</dd>
                </div>
                <div className="releases-meta-row">
                  <dt><HardDrive size={14} /> Portable EXE</dt>
                  <dd>{desktop.portableMeta.sizeLabel}</dd>
                </div>
                <div className="releases-meta-row">
                  <dt><Package size={14} /> Installer</dt>
                  <dd>{desktop.setupMeta.sizeLabel}</dd>
                </div>
              </dl>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                {desktop.portableMeta.available && (
                  <a href={`/downloads/${desktop.portableFile}`} className="releases-download-btn" download={desktop.portableFile}>
                    <Download size={18} /> Portable EXE
                  </a>
                )}
                {desktop.setupMeta.available && (
                  <a href={`/downloads/${desktop.setupFile}`} className="releases-download-btn releases-download-btn-secondary" download={desktop.setupFile}>
                    <Download size={18} /> Setup installer
                  </a>
                )}
              </div>
              {desktop.notes && (
                <p className="releases-apk-notes"><strong>Notes:</strong> {desktop.notes}</p>
              )}
            </article>

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
                    <strong>Master Admin Web &amp; Desktop</strong>
                    <p>
                      Central command hub for administrators — browser or Windows desktop app. Register supervisors,
                      guards, premises, and territories. Command Centre receives live SOS, GPS clock-ins, patrol taps, and incidents.
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
