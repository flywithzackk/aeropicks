import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function MyBets() {
  const { authFetch } = useAuth();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/bets').then(r => r.json()).then(d => {
      setBets(d.bets || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Group bets by competition
  const grouped = {};
  bets.forEach(b => {
    if (!grouped[b.competitionId]) {
      grouped[b.competitionId] = { name: b.competitionName, id: b.competitionId, bets: [] };
    }
    grouped[b.competitionId].bets.push(b);
  });
  const groups = Object.values(grouped);

  const wonBets = bets.filter(b => b.status === 'won');
  const lostBets = bets.filter(b => b.status === 'lost');
  const pendingBets = bets.filter(b => b.status === 'pending');
  const totalWon = wonBets.reduce((s, b) => s + b.payout, 0);
  const totalInPlay = pendingBets.reduce((s, b) => s + b.points, 0);

  return (
    <div>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow fade-up">
              <span className="dot" style={{ background: 'var(--coral)' }} />
              Your Picks
            </div>
            <h1 className="display fade-up" style={{ animationDelay: '0.07s' }}>
              The <span style={{ color: 'var(--coral)' }}>book.</span>
            </h1>
          </div>
          <div className="stat-panel fade-up" style={{ animationDelay: '0.14s' }}>
            <div className="stat-row">
              <span className="stat-label">Total Won</span>
              <span className="stat-value" style={{ color: 'var(--lime)' }}>{totalWon.toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">In Play</span>
              <span className="stat-value" style={{ color: 'var(--electric)' }}>{totalInPlay.toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Picks · Won</span>
              <span className="stat-value">{bets.length} · {wonBets.length}</span>
            </div>
          </div>
        </div>
      </section>

      {loading && <div style={{ padding: 60 }}><div className="spinner" /></div>}

      {!loading && bets.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🎟️</div>
          <div className="empty-title">No picks yet</div>
          <p className="small" style={{ marginBottom: 16 }}>Pick a competition and predict pilot placements.</p>
          <Link to="/competitions" className="btn btn-coral btn-sm">Browse Competitions →</Link>
        </div>
      )}

      {!loading && groups.map((g, gi) => {
        const gWon = g.bets.filter(b => b.status === 'won').length;
        const gTotal = g.bets.reduce((s, b) => s + b.points, 0);
        const gPayout = g.bets.reduce((s, b) => s + (b.payout || 0), 0);
        const hasSettled = g.bets.some(b => b.status !== 'pending');
        return (
          <div key={g.id} className="panel fade-up" style={{ animationDelay: `${gi * 0.06}s`, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 12 }}>
              <Link to={`/competition/${g.id}`} className="h3" style={{ color: 'var(--ink)' }}>{g.name}</Link>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {hasSettled ? (
                  <>
                    <span className="tag" style={{ background: 'var(--lime-wash)', color: 'var(--lime)' }}>
                      Won {gPayout.toLocaleString()}
                    </span>
                    <span className="small">{gWon} of {g.bets.length} picks hit</span>
                  </>
                ) : (
                  <span className="tag" style={{ background: 'var(--electric-wash)', color: 'var(--electric)' }}>
                    {gTotal} pts in play
                  </span>
                )}
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Pilot</th>
                    <th>Pick</th>
                    <th>Wager</th>
                    <th>Odds</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {g.bets.map((b, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {b.pilotPhoto ? (
                            <img src={b.pilotPhoto} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--bg-tint)' }} />
                          )}
                          <div>
                            <div className="cell-name" style={{ fontSize: 14 }}>{b.pilotName}</div>
                            {b.balloon && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{b.balloon}"</div>}
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--coral)' }}>{ordinal(b.place)}</span></td>
                      <td style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{b.points}</td>
                      <td className="mono" style={{ color: 'var(--electric)', fontWeight: 600 }}>{b.odds}×</td>
                      <td style={{ textAlign: 'right', paddingRight: 24 }}>
                        {b.status === 'won' && (
                          <span style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--lime)' }}>+{b.payout}</span>
                        )}
                        {b.status === 'lost' && (
                          <span className="tag" style={{ background: 'var(--red-wash)', color: 'var(--red)' }}>Lost</span>
                        )}
                        {b.status === 'pending' && (
                          <span className="tag tag-draft">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
