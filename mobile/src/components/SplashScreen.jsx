export default function SplashScreen({ exiting }) {
  return (
    <div className={`mob-splash ${exiting ? 'mob-splash-exit' : ''}`}>
      <div className="mob-splash-rings">
        <span className="mob-splash-ring ring-1" />
        <span className="mob-splash-ring ring-2" />
        <span className="mob-splash-ring ring-3" />
      </div>
      <img src="/emblem-dark.jpg" alt="Titan Protection" className="mob-splash-wordmark" />
      <p className="mob-splash-tagline">Built to Protect</p>
      <div className="mob-splash-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}
