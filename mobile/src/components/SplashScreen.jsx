import { Shield } from 'lucide-react';

export default function SplashScreen({ exiting }) {
  return (
    <div className={`mob-splash ${exiting ? 'mob-splash-exit' : ''}`}>
      <div className="mob-splash-rings">
        <span className="mob-splash-ring ring-1" />
        <span className="mob-splash-ring ring-2" />
        <span className="mob-splash-ring ring-3" />
      </div>
      <div className="mob-splash-logo">
        <Shield size={52} strokeWidth={1.75} />
      </div>
      <h1 className="mob-splash-title">Titan Monitor</h1>
      <p className="mob-splash-tagline">Built to Protect</p>
      <div className="mob-splash-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}
