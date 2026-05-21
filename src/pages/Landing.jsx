import { useAuth } from '../lib/auth.jsx';

const STEPS = [
  { num: '01', color: 'var(--sky)', title: 'Get Your Stake', body: 'Every new member is credited 1,000 points the moment they join.' },
  { num: '02', color: 'var(--electric)', title: 'Study the Field', body: 'Browse the pilot roster for each competition with live odds.' },
  { num: '03', color: 'var(--coral)', title: 'Place Your Picks', body: 'Spread points across as many or as few pilots as you like.' },
  { num: '04', color: 'var(--violet)', title: 'Watch It Fly', body: 'Wagers lock at flight time. Standings post when the dust settles.' },
];

export default function Landing() {
  const { login, signup } = useAuth();

  return (
    <>
      <nav className="nav">
        <div className="shell nav-inner">
          <div className="brand">
            <img src="/logos/aeropickswordwbaggie.png" alt="Aeropicks" className="brand-logo" />
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={login}>Sign In</button>
            <button className="btn btn-sky btn-sm" onClick={signup}>Sign Up</button>
          </div>
        </div>
      </nav>

      <main className="shell">
        <section className="landing-hero">
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }} className="landing-grid">
            <div>
              <div className="eyebrow fade-up">
                <span className="dot" />
                Now Wagering · Rio Grande Classic 2026
              </div>
              <h1 className="display fade-up" style={{ animationDelay: '0.08s' }}>
                Pick the pilot.<br />
                Drop your <span style={{ color: 'var(--sky)' }}>mark.</span>
              </h1>
              <p className="body fade-up" style={{ animationDelay: '0.16s', marginTop: 24, maxWidth: 460, fontSize: 18 }}>
                The wagering floor for hot air balloon competition. Get 1,000 points,
                back the pilots you believe in, and see who reads the wind best.
              </p>
              <div className="fade-up" style={{ animationDelay: '0.24s', marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-sky btn-lg" onClick={signup}>
                  Claim 1,000 Points
                </button>
                <button className="btn btn-ghost btn-lg" onClick={login}>
                  Sign In
                </button>
              </div>
            </div>

            <div className="hero-logo-wrap fade-up" style={{ animationDelay: '0.12s' }}>
              <div className="hero-logo-glow" />
              <img src="/logos/Aeropicks-target.png" alt="Aeropicks" className="hero-logo" style={{ animation: 'floaty 7s ease-in-out infinite' }} />
            </div>
          </div>
        </section>

        <section style={{ marginTop: 64 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--ink)' }} />
              <h2 className="h2-display">How It Works</h2>
            </div>
          </div>
          <div className="step-grid">
            {STEPS.map((s, i) => (
              <div key={s.num} className="step-card fade-up" style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
                <div className="step-num" style={{ color: s.color }}>{s.num}</div>
                <h3 className="h3" style={{ marginBottom: 8 }}>{s.title}</h3>
                <p className="small" style={{ lineHeight: 1.5 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 48 }}>
          <div className="cta-banner fade-up" style={{ animationDelay: '0.6s' }}>
            <div className="cta-banner-glow" />
            <div style={{ position: 'relative' }}>
              <div className="kicker" style={{ color: 'var(--sky)', marginBottom: 8 }}>First Competition</div>
              <h2 className="h1-display" style={{ color: 'var(--bg)' }}>Rio Grande Classic 2026</h2>
              <p className="small" style={{ color: 'rgba(251,251,249,0.6)', marginTop: 6 }}>
                31 pilots · Rio Rancho, New Mexico
              </p>
            </div>
            <button className="btn btn-sky btn-lg" style={{ position: 'relative' }} onClick={signup}>
              Join the Floor →
            </button>
          </div>
        </section>
      </main>

      <footer className="shell footer">
        <span className="footer-brand">AEROPICKS</span>
        <span className="small">Pick your pilots. Drop your marks.</span>
      </footer>
    </>
  );
}
