export default function SplashScreen({ exiting, title = 'Titan Monitor', subtitle = 'Built to Protect' }) {
  return (
    <div className={`mob-splash ${exiting ? 'mob-splash-exit' : ''}`}>
      <div className="mob-splash-rings">
        <span className="mob-splash-ring ring-1" />
        <span className="mob-splash-ring ring-2" />
        <span className="mob-splash-ring ring-3" />
      </div>
      <img src="/emblem-dark.jpg" alt="Titan Protection" className="mob-splash-wordmark" />
      <p className="mob-splash-tagline">{title}</p>
      {subtitle && <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.25rem' }}>{subtitle}</p>}
      <div className="mob-splash-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}
