import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Home() {
  const { authFetch } = useAuth();
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [potential, setPotential] = useState(null); // { compName, breakdown, total, top5 }

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(async d => {
      const all = d.competitions || [];
      setComps(all);
      // For the first live comp, compute the user's potential payout against provisional
      const live = all.find(c => c.status === 'live' || c.status === 'locked');
      if (live) {
        const [fullComp, betsRes] = await Promise.all([
          authFetch(`/api/competitions?id=${live.id}`).then(r => r.json()),
          authFetch(`/api/bets?competitionId=${live.id}`).then(r => r.json()),
        ]);
        const fullCompData = fullComp.competition;
        const provisional = fullCompData?.provisionalResults || {};
        if (Object.keys(provisional).length > 0) {
          const userBets = betsRes.bets || [];
          let total = 0;
          const winners = [];
          for (const bet of userBets) {
            if (bet.status === 'refunded') continue;
            const currentPlace = Number(provisional[bet.pilotId]);
            if (currentPlace && currentPlace === bet.place) {
              const payout = Math.round(bet.points * bet.odds);
              total += payout;
              const pilot = fullCompData.competitors?.find(c => c.id === bet.pilotId);
              winners.push({
                pilotName: pilot?.name || 'Pilot',
                pilotPhoto: pilot?.photo || null,
                place: bet.place,
                points: bet.points,
                odds: bet.odds,
                payout,
              });
            }
          }
          // Top 5 of current standings
          const top5 = Object.entries(provisional)
            .map(([pid, pl]) => {
              const pilot = fullCompData.competitors?.find(c => c.id === pid);
              return pilot ? { name: pilot.name, photo: pilot.photo, place: Number(pl), number: pilot.number } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.place - b.place)
            .slice(0, 5);
          setPotential({
            compName: live.name,
            compId: live.id,
            total,
            winners,
            top5,
            hasPicks: userBets.length > 0,
          });
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const liveComps = comps.filter(c => c.status === 'live' || c.status === 'locked');
  const upcomingComps = comps.filter(c => c.status === 'upcoming');
  const settledComps = comps.filter(c => c.status === 'settled');
  const liveCount = comps.filter(c => c.status === 'live').length;

  return (
    <div>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow fade-up">
              <span className="dot" />
              The Floor Is Open
            </div>
            <h1 className="display fade-up" style={{ animationDelay: '0.07s' }}>
              Pick your<br /><span style={{ color: 'var(--sky)' }}>pilots.</span>
            </h1>
            <p className="body fade-up" style={{ animationDelay: '0.12s', marginTop: 20, maxWidth: 460 }}>
              Each competition gives you 1,000 fresh points. Predict the exact finishing places. Exact hits pay big.
            </p>
          </div>
          <div className="stat-panel fade-up" style={{ animationDelay: '0.16s' }}>
            <div className="stat-row">
              <span className="stat-label">Live Now</span>
              <span className="stat-value" style={{ color: 'var(--lime)' }}>{liveCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Upcoming</span>
              <span className="stat-value" style={{ color: 'var(--sky)' }}>{upcomingComps.length}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Settled</span>
              <span className="stat-value">{settledComps.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE TRACKER WIDGET — current standings + your potential */}
      {potential && (
        <section className="live-tracker-widget fade-up" style={{ marginBottom: 28 }}>
          <div className="ltw-grid">
            <div className="ltw-standings">
              <div className="kicker" style={{ color: 'var(--lime)', marginBottom: 8 }}>● Live · {potential.compName}</div>
              <h3 className="h2" style={{ marginBottom: 14 }}>Current Standings</h3>
              <div className="ltw-top5">
                {potential.top5.length === 0 ? (
                  <p className="small">Standings post when scores are released.</p>
                ) : (
                  potential.top5.map(p => (
                    <div key={p.place} className="ltw-row">
                      <span className="ltw-place">{p.place}</span>
                      {p.photo ? <img src={p.photo} alt="" /> : <div className="ltw-photo-placeholder">?</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ltw-name">{p.name}</div>
                        <div className="small">Banner #{p.number}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Link to={`/competition/${potential.compId}`} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                Full Standings →
              </Link>
            </div>

            <div className="ltw-payout">
              <div className="kicker" style={{ color: 'var(--electric)', marginBottom: 8 }}>If standings hold</div>
              <h3 className="h2" style={{ marginBottom: 14 }}>Your Potential</h3>
              {!potential.hasPicks ? (
                <div>
                  <p className="small" style={{ marginBottom: 12 }}>You haven't placed any picks for {potential.compName} yet.</p>
                  <Link to={`/competition/${potential.compId}`} className="btn btn-sky btn-sm">Place Picks →</Link>
                </div>
              ) : (
                <>
                  <div className="ltw-big-number">
                    <span className="ltw-num" style={{ color: potential.total > 0 ? 'var(--lime)' : 'var(--ink-mute)' }}>
                      {potential.total > 0 ? `+${potential.total.toLocaleString()}` : '0'}
                    </span>
                    <span className="ltw-num-label">points</span>
                  </div>
                  {potential.winners.length > 0 ? (
                    <div className="ltw-winners">
                      {potential.winners.slice(0, 3).map((w, i) => (
                        <div key={i} className="ltw-winner-row">
                          {w.pilotPhoto ? <img src={w.pilotPhoto} alt="" /> : <div className="ltw-photo-placeholder">?</div>}
                          <span className="ltw-winner-name">{w.pilotName}</span>
                          <span className="ltw-winner-pay">+{w.payout}</span>
                        </div>
                      ))}
                      {potential.winners.length > 3 && (
                        <div className="small" style={{ marginTop: 6 }}>+ {potential.winners.length - 3} more hits</div>
                      )}
                    </div>
                  ) : (
                    <p className="small">No exact hits yet — your picks aren't matching the current places.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {loading && <div style={{ padding: 60 }}><div className="spinner" /></div>}

      {!loading && comps.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🎈</div>
          <div className="empty-title">No competitions yet</div>
          <p className="small">Check back soon.</p>
        </div>
      )}

      {/* LIVE NOW */}
      {liveComps.length > 0 && (
        <>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--sky)' }} />
              <h2 className="h2-display">Live Now</h2>
            </div>
          </div>
          <div className="featured-comp-grid">
            {liveComps.map((c, i) => (
              <Link
                to={`/competition/${c.id}`}
                key={c.id}
                className="rgc-feature fade-up"
                style={{ animationDelay: `${i * 0.05}s`, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                {c.bannerImage ? (
                  <div className="rgc-feature-banner" style={{ backgroundImage: `url(${c.bannerImage})` }} />
                ) : (
                  <div className="rgc-feature-banner rgc-feature-banner-default" />
                )}
                <div className="rgc-feature-content">
                  {c.logoImage ? (
                    <img src={c.logoImage} alt="" className="rgc-feature-logo" />
                  ) : (
                    <div className="rgc-feature-logo rgc-feature-logo-default">🎈</div>
                  )}
                  <div className="rgc-feature-info">
                    <div className="kicker" style={{ color: c.status === 'locked' ? 'var(--red)' : 'var(--lime)', marginBottom: 8 }}>
                      {c.status === 'locked' ? 'Picks Locked' : 'Now Live'} · {c.location || 'New Mexico'}
                    </div>
                    <h2 className="h1-display" style={{ marginBottom: 6 }}>{c.name}</h2>
                    <p className="small" style={{ marginBottom: 6 }}>{c.dates || 'Dates TBA'}</p>
                    <p className="small" style={{ color: 'var(--ink-mute)' }}>
                      {c.competitorCount ?? 0} pilots · {(c.eventLevel || 'state').toUpperCase()}
                      {c.hasWildcard && <span className="tag" style={{ background: 'var(--violet-wash)', color: 'var(--violet)', marginLeft: 8 }}>+ Wildcard</span>}
                    </p>
                    <span className="btn btn-sky btn-lg" style={{ marginTop: 20 }}>
                      {c.status === 'locked' ? 'View Picks →' : 'Place Picks →'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* COMING SOON */}
      {upcomingComps.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 40 }}>
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--electric)' }} />
              <h2 className="h2-display">Coming Soon</h2>
            </div>
            <span className="small">{upcomingComps.length} upcoming</span>
          </div>
          <div className="upcoming-grid">
            {upcomingComps.map((c, i) => (
              <UpcomingCard key={c.id} comp={c} index={i} authFetch={authFetch} />
            ))}
          </div>
        </>
      )}

      {/* SETTLED */}
      {settledComps.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 40 }}>
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--ink-mute)' }} />
              <h2 className="h2-display">Past Events</h2>
            </div>
            <span className="small">{settledComps.length} settled</span>
          </div>
          <div className="card-grid">
            {settledComps.map((c, i) => (
              <Link to={`/competition/${c.id}`} key={c.id} className="comp-card fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="comp-card-top">
                  <span className="comp-loc">{c.location || 'New Mexico'} · {c.eventLevel?.toUpperCase()}</span>
                  <span className="tag tag-locked">settled</span>
                </div>
                <div>
                  <h3 className="h2" style={{ fontSize: 24, marginBottom: 4 }}>{c.name}</h3>
                  <p className="small">{c.dates || ''}</p>
                </div>
                <div className="comp-card-foot">
                  <div className="pilot-count">
                    <span className="num" style={{ color: 'var(--sky-deep)' }}>{c.competitorCount ?? 0}</span>
                    <span className="small">pilots</span>
                  </div>
                  <span className="btn btn-ghost btn-sm">Results →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UpcomingCard({ comp, index, authFetch }) {
  const [notified, setNotified] = useState(false);
  const [busy, setBusy] = useState(false);
  const subscribe = async () => {
    setBusy(true);
    const res = await authFetch('/api/notify-subscribe', {
      method: 'POST',
      body: JSON.stringify({ competitionId: comp.id }),
    });
    setBusy(false);
    if (res.ok) setNotified(true);
  };
  return (
    <div className="upcoming-card fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
      {comp.bannerImage && (
        <div className="upcoming-banner" style={{ backgroundImage: `url(${comp.bannerImage})` }} />
      )}
      <div className="upcoming-content">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {comp.logoImage ? (
            <img src={comp.logoImage} alt="" className="upcoming-logo" />
          ) : (
            <div className="upcoming-logo upcoming-logo-default">🎈</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker" style={{ color: 'var(--electric)', marginBottom: 4 }}>
              Coming Soon · {comp.location || 'New Mexico'}
            </div>
            <h3 className="h2" style={{ fontSize: 22, marginBottom: 4 }}>{comp.name}</h3>
            <p className="small">{comp.dates || 'Dates TBA'} · {comp.competitorCount ?? 0} pilots</p>
          </div>
        </div>
        <button
          className={`btn ${notified ? 'btn-ghost' : 'btn-electric'} btn-sm`}
          onClick={subscribe}
          disabled={busy || notified}
          style={{ marginTop: 14 }}
        >
          {notified ? '✓ You\'ll be notified' : busy ? 'Saving…' : '🔔 Notify Me When Picks Open'}
        </button>
      </div>
    </div>
  );
}
