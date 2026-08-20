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
    version: '1.0.19',
    versionCode: 19,
    apkFile: 'titan-monitor-latest.apk',
    notes: '±5m GPS for clock-in and patrol — warmup + stabilization for reliable fixes. Visitor QR scanner, splash refresh, in-app update panel.',
  },
  supervisor: {
    appId: 'supervisor',
    name: 'Titan Supervisor',
    description: 'Supervisor field app - teams, sites, and territory operations.',
    version: '1.2.0',
    versionCode: 20,
    apkFile: 'titan-supervisor-latest.apk',
    notes: '±5m site & patrol GPS (warmup + 3 stable readings). Loading progress on Register Site / Add Place. Improved permissions and sign-in.',
  },
};
