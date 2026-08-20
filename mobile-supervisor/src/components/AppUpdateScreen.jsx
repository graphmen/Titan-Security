import { ArrowLeft } from 'lucide-react';
import AppUpdatePanel from './AppUpdatePanel';

export default function AppUpdateScreen({ apiBase, onClose }) {
  return (
    <div className="app-update-screen">
      <div className="app-update-screen-inner">
        <button type="button" className="app-update-screen-back" onClick={onClose}>
          <ArrowLeft size={18} /> Back
        </button>
        <h2 className="app-update-screen-title">App Update</h2>
        <p className="app-update-screen-sub">
          One tap downloads and opens the Android installer — no manual APK hunt needed.
        </p>
        <AppUpdatePanel apiBase={apiBase} fullPage />
      </div>
    </div>
  );
}
