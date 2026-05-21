import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function Leaderboard() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({ leaderboard: [], you: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/leaderboard').then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow fade-up">
              <span className="dot" style={{ background: 'var(--lime)' }} />
              Hall of Picks
            </div>
            <h1 className="display fade-up" style={{ animationDelay: '0.07s' }}>
              The <span style={{ color: 'var(--lime)' }}>board.</span>
            </h1>
          </div>
          {data.you && (
            <div className="stat-panel fade-up" style={{ animationDelay: '0.14s' }}>
              <div className="stat-row">
                <span className="stat-label">Your Rank</span>
                <span className="stat-value" style={{ color: 'var(--lime)' }}>#{data.you.rank}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Total Won</span>
                <span className="stat-value">{data.you.total.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Competitions</span>
                <span className="stat-value">{data.you.competitionsWon}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {loading && <div style={{ padding: 60 }}><div className="spinner" /></div>}

      {!loading && data.leaderboard.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <div className="empty-title">No winners yet</div>
          <p className="small">The leaderboard fills up once competitions settle.</p>
        </div>
      )}

      {!loading && data.leaderboard.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24, width: 80 }}>Rank</th>
                  <th>Member</th>
                  <th>Comps Won</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Total Won</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map(row => (
                  <tr key={row.rank} style={row.isYou ? { background: 'var(--lime-wash)' } : {}}>
                    <td style={{ paddingLeft: 24, fontFamily: 'var(--display)', fontSize: 22 }}>
                      {row.rank <= 3 ? (
                        <span style={{ color: row.rank === 1 ? '#d4a017' : row.rank === 2 ? '#8a8a8a' : '#b97500' }}>
                          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : `#${row.rank}`}
                    </td>
                    <td className="cell-name" style={{ color: row.isYou ? 'var(--lime)' : 'var(--ink)' }}>
                      {row.label}
                      {row.isYou && <span className="tag" style={{ marginLeft: 8, background: 'var(--lime)', color: '#fff' }}>You</span>}
                    </td>
                    <td className="mono">{row.competitionsWon}</td>
                    <td style={{ textAlign: 'right', paddingRight: 24, fontFamily: 'var(--display)', fontSize: 24, color: 'var(--lime)' }}>
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
