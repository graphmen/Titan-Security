import { NextResponse } from 'next/server';
import { FALLBACK_MANIFEST, loadDownloadsManifest } from '../../../../lib/downloadsManifest';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

async function loadManifest() {
  try {
    return await loadDownloadsManifest();
  } catch (err) {
    console.error('mobile/version manifest read failed, using fallback:', err);
    return FALLBACK_MANIFEST;
  }
}

export async function GET(req) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  const app = url.searchParams.get('app');

  try {
    const manifest = await loadManifest();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || `${url.protocol}//${url.host}`;

    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (app === 'monitor' || app === 'supervisor') {
      const entry = manifest[app];
      if (!entry) {
        return NextResponse.json({ error: 'Unknown app' }, { status: 404, headers: cors });
      }
      const apkUrl = `${baseUrl.replace(/\/$/, '')}/downloads/${entry.apkFile}`;
      return NextResponse.json(
        {
          appId: entry.appId,
          name: entry.name,
          version: entry.version,
          versionCode: entry.versionCode,
          apkUrl,
          notes: entry.notes || '',
          updatedAt: manifest.updatedAt,
        },
        { headers: { ...CACHE_HEADERS, ...cors } }
      );
    }

    const apps = {};
    for (const key of ['monitor', 'supervisor']) {
      const entry = manifest[key];
      if (!entry) continue;
      apps[key] = {
        ...entry,
        apkUrl: `${baseUrl.replace(/\/$/, '')}/downloads/${entry.apkFile}`,
      };
    }

    return NextResponse.json({ updatedAt: manifest.updatedAt, apps }, { headers: { ...CACHE_HEADERS, ...cors } });
  } catch (err) {
    console.error('mobile/version error:', err);
    return NextResponse.json({ error: 'Version manifest unavailable' }, { status: 503 });
  }
}

export async function OPTIONS(req) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
