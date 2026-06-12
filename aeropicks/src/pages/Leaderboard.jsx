import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function Leaderboard() {
  const { authFetch } = useAuth();
  const [view, setView] = useState('overall'); // 'overall' | 'round'
  const [comps, setComps] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [roundMode, setRoundMode] = useState('payout'); // 'payout' | 'wagered'
  const [data, setData] = useState({ leaderboard: [], you: null });
  const [loading, setLoading] = useState(true);

  // Load competition list once for the Round selector
  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      const list = (d.competitions || []).filter(c => c.status !== 'draft' && c.status !== 'upcoming');
      setComps(list);
      // Default the round selector to the most recent live/locked/settled comp
      if (!selectedCompId && list.length > 0) {
        const live = list.find(c => c.status === 'live') || list.find(c => c.status === 'locked') || list[0];
        setSelectedCompId(live.id);
      }
    }).catch(() => {});
  }, []);

  // Load leaderboard data based on view + selection
  useEffect(() => {
    setLoading(true);
    let url = '/api/leaderboard';
    if (view === 'round' && selectedCompId) {
      url += `?competitionId=${selectedCompId}&mode=${roundMode}`;
    }
    authFetch(url).then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [view, selectedCompId, roundMode]);

  const isRound = view === 'round';
  const roundComp = data.competition;
  const settledRound = roundComp?.status === 'settled';
  const liveRound = roundComp?.status === 'live' || roundComp?.status === 'locked';

  return (
    <div>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow fade-up">
              <span className="dot" style={{ background: 'var(--lime)' }} />
              {isRound ? 'Round Leaderboard' : 'Overall Leaderboard'}
            </div>
            <h1 className="display fade-up" style={{ animationDelay: '0.07s' }}>
              The <span style={{ color: 'var(--lime)' }}>board.</span>
            </h1>
          </div>
          {data.you && !isRound && (
            <div className="stat-panel fade-up" style={{ animationDelay: '0.14s' }}>
              <div className="stat-row">
                <span className="stat-label">Your Rank</span>
                <span className="stat-value" style={{ color: 'var(--lime)' }}>#{data.you.rank}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Total Won</span>
                <span className="stat-value">{(data.you.total || 0).toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Rounds Won</span>
                <span className="stat-value">{data.you.competitionsWon || 0}</span>
              </div>
            </div>
          )}
          {data.you && isRound && (
            <div className="stat-panel fade-up" style={{ animationDelay: '0.14s' }}>
              <div className="stat-row">
                <span className="stat-label">Your Rank</span>
                <span className="stat-value" style={{ color: 'var(--lime)' }}>#{data.you.rank}</span>
              </div>
              {settledRound ? (
                <div className="stat-row">
                  <span className="stat-label">You Won</span>
                  <span className="stat-value">{(data.you.actualWon || 0).toLocaleString()}</span>
                </div>
              ) : roundMode === 'payout' ? (
                <div className="stat-row">
                  <span className="stat-label">Your Potential</span>
                  <span className="stat-value" style={{ color: 'var(--electric)' }}>
                    {(data.you.potentialPayout || 0).toLocaleString()}
                  </span>
                </div>
              ) : (
                <div className="stat-row">
                  <span className="stat-label">You Wagered</span>
                  <span className="stat-value">{(data.you.totalWagered || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="stat-row">
                <span className="stat-label">Picks</span>
                <span className="stat-value">{data.you.pickCount || 0}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* View toggle */}
      <div className="lb-toggle-bar fade-up">
        <div className="lb-toggle">
          <button
            type="button"
            className={`lb-toggle-btn ${view === 'overall' ? 'lb-toggle-active' : ''}`}
            onClick={() => setView('overall')}
          >Overall</button>
          <button
            type="button"
            className={`lb-toggle-btn ${view === 'round' ? 'lb-toggle-active' : ''}`}
            onClick={() => setView('round')}
            disabled={comps.length === 0}
          >Round</button>
        </div>
        {isRound && (
          <div className="lb-round-controls">
            <select
              className="input"
              value={selectedCompId}
              onChange={e => setSelectedCompId(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {comps.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status === 'live' ? '· LIVE' : c.status === 'locked' ? '· LOCKED' : c.status === 'settled' ? '· SETTLED' : ''}
                </option>
              ))}
            </select>
            {liveRound && (
              <div className="lb-toggle" style={{ marginLeft: 10 }}>
                <button
                  type="button"
                  className={`lb-toggle-btn lb-toggle-sm ${roundMode === 'payout' ? 'lb-toggle-active' : ''}`}
                  onClick={() => setRoundMode('payout')}
                  title="Who's leading if current standings hold"
                >Potential</button>
                <button
                  type="button"
                  className={`lb-toggle-btn lb-toggle-sm ${roundMode === 'wagered' ? 'lb-toggle-active' : ''}`}
                  onClick={() => setRoundMode('wagered')}
                  title="Who's wagered the most points"
                >Wagered</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context note */}
      {isRound && roundComp && (
        <p className="small" style={{ marginBottom: 14 }}>
          {settledRound && 'Final standings for this round.'}
          {liveRound && roundMode === 'payout' && (roundComp.hasProvisional
            ? 'Live race — ranked by what each member would win if current standings hold.'
            : 'No standings posted yet — leaderboard will fill in as scores come in.')}
          {liveRound && roundMode === 'wagered' && 'Who has the most points committed to this round.'}
        </p>
      )}

      {loading && <div style={{ padding: 60 }}><div className="spinner" /></div>}

      {!loading && data.leaderboard.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <div className="empty-title">
            {isRound ? 'No picks placed in this round yet' : 'No winners yet'}
          </div>
          <p className="small">
            {isRound
              ? 'Once members start placing picks, this fills up.'
              : 'The overall leaderboard fills up once competitions settle.'}
          </p>
        </div>
      )}

      {!loading && data.leaderboard.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                {isRound ? (
                  <tr>
                    <th style={{ paddingLeft: 24, width: 80 }}>Rank</th>
                    <th>Member</th>
                    <th>Picks</th>
                    <th>Wagered</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>
                      {settledRound ? 'Won' : roundMode === 'payout' ? 'Potential' : 'Wagered'}
                    </th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ paddingLeft: 24, width: 80 }}>Rank</th>
                    <th>Member</th>
                    <th>Rounds Won</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Total Won</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {data.leaderboard.map(row => (
                  <tr key={`${row.rank}-${row.username}`} style={row.isYou ? { background: 'var(--lime-wash)' } : {}}>
                    <td style={{ paddingLeft: 24, fontFamily: 'var(--display)', fontSize: 22 }}>
                      {row.rank <= 3 ? (
                        <span style={{ color: row.rank === 1 ? '#d4a017' : row.rank === 2 ? '#8a8a8a' : '#b97500' }}>
                          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : `#${row.rank}`}
                    </td>
                    <td className="cell-name" style={{ color: row.isYou ? 'var(--lime)' : 'var(--ink)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.photo ? (
                          <img src={row.photo} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--r-pill)', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 'var(--r-pill)', background: 'var(--bg-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: 14, color: 'var(--ink-mute)' }}>
                            {(row.username || '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <span>{row.username}</span>
                        {row.isYou && <span className="tag" style={{ background: 'var(--lime)', color: '#fff' }}>You</span>}
                      </div>
                    </td>
                    {isRound ? (
                      <>
                        <td className="mono">{row.pickCount}</td>
                        <td className="mono">{row.totalWagered.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', paddingRight: 24, fontFamily: 'var(--display)', fontSize: 24, color: 'var(--lime)' }}>
                          {(row.primaryStat || 0).toLocaleString()}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="mono">{row.competitionsWon}</td>
                        <td style={{ textAlign: 'right', paddingRight: 24, fontFamily: 'var(--display)', fontSize: 24, color: 'var(--lime)' }}>
                          {row.total.toLocaleString()}
                        </td>
                      </>
                    )}
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
