import { Link } from 'react-router-dom';

export default function HowToPlay({ asModal = false, onClose }) {
  const content = (
    <>
      <section className="hero" style={{ paddingBottom: 16, marginBottom: 16 }}>
        <div className="eyebrow"><span className="dot" />How To Play</div>
        <h1 className="display" style={{ fontSize: 'clamp(48px, 9vw, 88px)' }}>
          Pick the <span style={{ color: 'var(--sky)' }}>winners.</span>
        </h1>
        <p className="body" style={{ marginTop: 14, maxWidth: 620 }}>
          Aeropicks is a wagering platform for competitive hot air ballooning. You back the pilots you believe in and see who rises to the top.
        </p>
      </section>

      <div className="htp-grid">
        <Card num="1" title="Sign up — it's free" color="var(--sky)">
          Create an account with a username and (optionally) a profile photo. Every member starts with the same blank slate.
        </Card>
        <Card num="2" title="Get 1,000 points each round" color="var(--electric)">
          For every competition, you get a fresh 1,000 points to spread across your picks. Points reset per event — they don't carry over.
        </Card>
        <Card num="3" title="Predict exact finishing places" color="var(--coral)">
          Pick a pilot, pick their exact finishing place (1st, 5th, 12th, whatever), and put points on it. You can place as many picks as you want until your 1,000 points are spent.
        </Card>
        <Card num="4" title="Exact hits pay big" color="var(--lime)">
          If your pilot finishes in the exact place you picked, you win <strong>points × odds</strong>. Off by even one place = $0. No partial credit.
        </Card>
        <Card num="5" title="Use the wildcard" color="var(--violet)">
          Each competition has a free bonus question. Get it right, win an extra 500 points. Costs nothing to enter.
        </Card>
        <Card num="6" title="Climb the leaderboard" color="var(--ink)">
          Total winnings across all competitions stack up. Top of the leaderboard takes bragging rights for the rest of the season.
        </Card>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 className="h2-display" style={{ marginBottom: 12 }}>Where the odds come from</h2>
        <div className="panel">
          <p className="body">
            Aeropicks calculates odds for every pilot at every possible finishing place. The algorithm pulls from:
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 22, color: 'var(--ink-soft)' }}>
            <li><strong>FAI World Rankings</strong> — for elite-level events</li>
            <li><strong>US National Rankings</strong> — for U.S.-based events</li>
            <li><strong>Local event history</strong> — head-to-head from past competitions at the same venue</li>
            <li><strong>Profile form</strong> — recent finishes weighted by recency</li>
          </ul>
          <p className="small" style={{ marginTop: 12 }}>
            Admins can hand-override odds based on local knowledge — ballooning has a real home-field advantage that raw rankings can't always capture.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 className="h2-display" style={{ marginBottom: 12 }}>Multi-day events</h2>
        <div className="panel">
          <p className="body">
            For multi-day competitions, picks lock at the start of the first task. As scores come in each day, the platform shows running standings and updates on the home page. Final payouts settle when the competition officially ends.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 className="h2-display" style={{ marginBottom: 12 }}>What happens if a pilot withdraws</h2>
        <div className="panel">
          <p className="body">
            Any points you wagered on a pilot who drops out get refunded to your per-competition balance. If picks are still open, you can re-deploy them onto another pilot. If picks have locked, the refunded points sit until the competition settles.
          </p>
        </div>
      </section>

      {asModal && (
        <button className="btn btn-sky btn-lg" onClick={onClose} style={{ marginTop: 28 }}>
          Got it — let me pick
        </button>
      )}
    </>
  );

  if (asModal) {
    return (
      <div className="auth-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="auth-card htp-modal">
          <button className="auth-close" onClick={onClose} aria-label="Close" type="button">×</button>
          <div style={{ paddingTop: 12 }}>{content}</div>
        </div>
      </div>
    );
  }

  return <div>{content}</div>;
}

function Card({ num, title, color, children }) {
  return (
    <div className="htp-card">
      <div className="htp-num" style={{ color }}>{num}</div>
      <div>
        <h3 className="h3" style={{ fontSize: 18, marginBottom: 6 }}>{title}</h3>
        <p className="small" style={{ color: 'var(--ink-soft)', lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  );
}
