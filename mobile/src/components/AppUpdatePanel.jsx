import { useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { APP_VERSION, APP_VERSION_CODE, MOBILE_APP_ID } from '../config';
import { fetchRemoteVersion, installApkUpdate, isNativeAndroid, isUpdateAvailable } from '../utils/appUpdate';

export default function AppUpdatePanel({ apiBase, compact = false }) {
  const [remote, setRemote] = useState(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState('');

  const updateReady = remote && isUpdateAvailable(remote, APP_VERSION_CODE);

  const runCheck = async () => {
    setChecking(true);
    setCheckError('');
    try {
      const info = await fetchRemoteVersion(apiBase, MOBILE_APP_ID);
      setRemote(info);
    } catch (err) {
      setCheckError(err.message || 'Update check failed');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, [apiBase]);

  const handleUpdate = async () => {
    if (!remote?.apkUrl || installing) return;
    setInstalling(true);
    setInstallError('');
    try {
      await installApkUpdate(remote.apkUrl);
    } catch (err) {
      setInstallError(err.message || 'Could not start update');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className={`app-update-panel ${compact ? 'compact' : ''}`}>
      <div className="app-update-row">
        <span className="app-update-label">
          App version <strong>v{APP_VERSION}</strong>
          {checking && <Loader2 size={12} className="spin inline-spin" />}
        </span>
        {!checking && (
          <button type="button" className="app-update-refresh" onClick={runCheck} aria-label="Check for updates">
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {!checking && updateReady && (
        <div className="app-update-available">
          <p>
            Update available: <strong>v{remote.version}</strong>
            {remote.notes ? ` — ${remote.notes}` : ''}
          </p>
          <button type="button" className="app-update-btn" onClick={handleUpdate} disabled={installing}>
            {installing ? (
              <>
                <Loader2 size={14} className="spin" /> Downloading…
              </>
            ) : (
              <>
                <Download size={14} /> Update app
              </>
            )}
          </button>
          {installError && <p className="app-update-error">{installError}</p>}
          {isNativeAndroid() && !installError && installing && (
            <p className="app-update-hint">When download finishes, tap Install on the Android prompt.</p>
          )}
        </div>
      )}

      {!checking && !updateReady && !checkError && (
        <p className="app-update-ok">
          <CheckCircle2 size={13} /> You have the latest version
        </p>
      )}

      {checkError && <p className="app-update-error">{checkError}</p>}
    </div>
  );
}
