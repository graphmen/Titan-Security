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
    version: '1.0.11',
    versionCode: 11,
    apkFile: 'titan-monitor-latest.apk',
    notes: '',
  },
  supervisor: {
    appId: 'supervisor',
    name: 'Titan Supervisor',
    description: 'Supervisor field app - teams, sites, and territory operations.',
    version: '1.1.2',
    versionCode: 12,
    apkFile: 'titan-supervisor-latest.apk',
    notes: '',
  },
};
