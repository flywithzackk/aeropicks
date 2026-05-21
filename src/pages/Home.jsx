import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Home() {
  const { authFetch } = useAuth();
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      setComps(d.competitions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const liveCount = comps.filter(c => c.status === 'live').length;
  const settledCount = comps.filter(c => c.status === 'settled').length;

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
              <span className="stat-label">Settled</span>
              <span className="stat-value">{settledCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Events</span>
              <span className="stat-value">{comps.length}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="section-head">
        <div className="section-title">
          <div className="section-bar" style={{ background: 'var(--sky)' }} />
          <h2 className="h2-display">Open Competitions</h2>
        </div>
      </div>

      {loading && <div style={{ padding: 60 }}><div className="spinner" /></div>}

      {!loading && comps.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🎈</div>
          <div className="empty-title">No competitions yet</div>
          <p className="small">Check back soon.</p>
        </div>
      )}

      {!loading && comps.length > 0 && (
        <div className="card-grid">
          {comps.map((c, i) => (
            <Link to={`/competition/${c.id}`} key={c.id} className="comp-card fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="comp-card-top">
                <span className="comp-loc">{c.location || 'New Mexico'} · {c.eventLevel?.toUpperCase()}</span>
                <span className={`tag tag-${c.status === 'settled' ? 'locked' : c.status || 'live'}`}>{c.status || 'live'}</span>
              </div>
              <div>
                <h3 className="h2" style={{ fontSize: 24, marginBottom: 4 }}>{c.name}</h3>
                <p className="small">{c.dates || 'Dates TBA'}</p>
              </div>
              <div className="comp-card-foot">
                <div className="pilot-count">
                  <span className="num" style={{ color: 'var(--sky-deep)' }}>{c.competitorCount ?? 0}</span>
                  <span className="small">pilots</span>
                  {c.hasWildcard && <span className="tag" style={{ background: 'var(--violet-wash)', color: 'var(--violet-deep)', marginLeft: 8 }}>+ Wildcard</span>}
                </div>
                <span className="btn btn-sky btn-sm">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
