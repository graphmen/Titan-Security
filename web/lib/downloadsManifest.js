import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Strip UTF-8 BOM written by PowerShell Set-Content -Encoding UTF8. */
export function parseJsonText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return parseJsonText(raw);
}

export function getDownloadsManifestPath() {
  return path.join(process.cwd(), 'public', 'downloads', 'versions.json');
}

export async function loadDownloadsManifest() {
  return readJsonFile(getDownloadsManifestPath());
}

export const FALLBACK_MANIFEST = {
  updatedAt: null,
  monitor: {
    appId: 'monitor',
    name: 'Titan Monitor',
    description: 'Guard field app - patrol, clock-in, SOS, and NFC checkpoints.',
    version: '1.0.31',
    versionCode: 31,
    apkFile: 'titan-monitor-latest.apk',
    notes: 'Fix: relaxed GPS for clock-out at premises (±15m) so guards can end shift on site.',
  },
  supervisor: {
    appId: 'supervisor',
    name: 'Titan Supervisor',
    description: 'Supervisor field app - teams, sites, and territory operations.',
    version: '1.2.5',
    versionCode: 25,
    apkFile: 'titan-supervisor-latest.apk',
    notes: 'Fix server connection — APK now calls titanprotection.org (not localhost). PIN login works.',
  },
  desktop: {
    appId: 'desktop',
    name: 'Titan Protection Desktop',
    description: 'Windows desktop client for Command Centre and supervisor portal.',
    version: '1.0.0',
    portableFile: 'titan-protection-desktop.exe',
    setupFile: 'titan-protection-desktop-setup.exe',
    notes: 'Electron wrapper for the live web dashboard — no separate login, always synced with production.',
  },
};
