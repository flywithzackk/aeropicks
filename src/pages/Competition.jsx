import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';

export default function Competition() {
  const { id } = useParams();
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comp, setComp] = useState(null);
  const [bets, setBets] = useState({}); // key = `${pilotId}:${place}`, value = points
  const [wildcardPick, setWildcardPick] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(1);
  const [pointInput, setPointInput] = useState(50);
  const [fieldSort, setFieldSort] = useState('banner');

  const sortedCompetitors = useMemo(() => {
    if (!comp?.competitors) return [];
    const list = [...comp.competitors];
    switch (fieldSort) {
      case 'bestOdds':
        return list.sort((a, b) => (a.oddsByPlace?.[1] || 999) - (b.oddsByPlace?.[1] || 999));
      case 'worstOdds':
        return list.sort((a, b) => (b.oddsByPlace?.[1] || 0) - (a.oddsByPlace?.[1] || 0));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'banner':
      default:
        return list.sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
    }
  }, [comp?.competitors, fieldSort]);

  useEffect(() => {
    Promise.all([
      authFetch(`/api/competitions?id=${id}`).then(r => r.json()),
      authFetch(`/api/bets?competitionId=${id}`).then(r => r.json()),
    ]).then(([compData, betsData]) => {
      setComp(compData.competition);
      const map = {};
      (betsData.bets || []).forEach(b => {
        map[`${b.pilotId}:${b.place}`] = { points: b.points, status: b.status || 'pending' };
      });
      setBets(map);
      setWildcardPick(betsData.wildcard?.value || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Only count non-refunded bets toward the wagered total
  const totalWagered = Object.values(bets).reduce((s, v) => {
    const points = typeof v === 'object' ? v.points : v;
    const status = typeof v === 'object' ? v.status : 'pending';
    return s + (status === 'refunded' ? 0 : (Number(points) || 0));
  }, 0);
  const remaining = 1000 - totalWagered;
  const pct = Math.min(100, (totalWagered / 1000) * 100);
  const locked = comp?.status === 'locked' || comp?.status === 'settled';

  const addBet = () => {
    if (!selectedPilot) return;
    if (pointInput <= 0) return;
    const key = `${selectedPilot.id}:${selectedPlace}`;
    const existing = bets[key];
    const currentForThis = existing ? (typeof existing === 'object' ? existing.points : Number(existing) || 0) : 0;
    const otherTotal = totalWagered - currentForThis;
    if (otherTotal + pointInput > 1000) {
      showToast(`Only ${1000 - otherTotal} points available`, 'error');
      return;
    }
    setBets(prev => ({ ...prev, [key]: { points: pointInput, status: 'pending' } }));
    showToast(`+${pointInput} on ${selectedPilot.name.split(',')[0]} @ ${ordinal(selectedPlace)}`);
    setSelectedPilot(null);
  };

  const removeBet = (pilotId, place) => {
    setBets(prev => {
      const next = { ...prev };
      delete next[`${pilotId}:${place}`];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    // Only save pending bets (refunded ones are server-side already and shouldn't be re-submitted)
    const betsList = Object.entries(bets)
      .filter(([k, v]) => {
        const status = typeof v === 'object' ? v.status : 'pending';
        return status !== 'refunded';
      })
      .map(([k, v]) => {
        const [pilotId, place] = k.split(':');
        const points = typeof v === 'object' ? v.points : v;
        return { pilotId, place: Number(place), points: Number(points) };
      });
    const res = await authFetch('/api/bets', {
      method: 'POST',
      body: JSON.stringify({
        competitionId: id,
        bets: betsList,
        wildcard: wildcardPick ? { value: wildcardPick } : null,
      }),
    });
    setSaving(false);
    if (res.ok) showToast('Picks placed');
    else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || 'Could not save', 'error');
    }
  };

  if (loading) return <div style={{ padding: 80 }}><div className="spinner" /></div>;
  if (!comp) return (
    <div className="empty">
      <div className="empty-icon">🔍</div>
      <div className="empty-title">Competition not found</div>
      <Link to="/competitions" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>Back</Link>
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* HERO */}
      <section className="hero" style={{ paddingBottom: 24 }}>
        <div className="hero-grid">
          <div>
            <div className="eyebrow fade-up">
              <span className="dot" style={{ background: locked ? 'var(--red)' : 'var(--lime)' }} />
              {comp.location} {comp.dates ? `· ${comp.dates}` : ''} · {(comp.eventLevel || 'state').toUpperCase()}
            </div>
            <h1 className="h1-display fade-up" style={{ animationDelay: '0.07s' }}>{comp.name}</h1>
            <p className="body fade-up" style={{ animationDelay: '0.12s', marginTop: 12, maxWidth: 520 }}>
              {comp.description || 'Predict the exact finishing place for each pilot. Spread your 1,000 points however you want. Exact hits only.'}
            </p>
          </div>
          <div className="stat-panel fade-up" style={{ animationDelay: '0.16s' }}>
            <div className="stat-row">
              <span className="stat-label">Wagered</span>
              <span className="stat-value" style={{ color: 'var(--electric)' }}>{totalWagered}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Remaining</span>
              <span className="stat-value" style={{ color: remaining < 0 ? 'var(--red)' : 'var(--ink)' }}>{remaining}</span>
            </div>
            <div className="stat-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${pct}%`, background: 'var(--electric)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {locked && (
        <div className="panel" style={{ background: 'var(--red-wash)', borderColor: 'var(--red)', marginBottom: 20, padding: '16px 22px' }}>
          <strong style={{ color: 'var(--red)' }}>Picks are locked.</strong>
          <span className="small" style={{ marginLeft: 8 }}>
            {comp.status === 'settled' ? 'Results have been settled.' : 'No new picks accepted.'}
          </span>
        </div>
      )}

      {/* CURRENT PICKS */}
      {Object.keys(bets).length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--coral)' }} />
              <h2 className="h2-display">Your Picks</h2>
            </div>
            <span className="small">{Object.keys(bets).length} picks · {totalWagered} pts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {Object.entries(bets).map(([key, val]) => {
              const points = typeof val === 'object' ? val.points : val;
              const status = typeof val === 'object' ? val.status : 'pending';
              const [pilotId, place] = key.split(':');
              const pilot = comp.competitors.find(c => c.id === pilotId);
              if (!pilot) return null;
              const odds = pilot.oddsByPlace?.[place] || 0;
              const potential = Math.round(points * odds);
              const isRefunded = status === 'refunded';
              return (
                <div key={key} className="panel" style={{ padding: 14, margin: 0, display: 'flex', gap: 12, alignItems: 'center', opacity: isRefunded ? 0.65 : 1 }}>
                  {pilot.photo ? (
                    <img src={pilot.photo} alt="" style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--bg-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: 20 }}>?</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-name" style={{ fontSize: 14 }}>
                      {pilot.name}
                      {isRefunded && <span className="tag" style={{ background: 'var(--coral-wash)', color: 'var(--coral)', marginLeft: 6, fontSize: 9 }}>REFUNDED</span>}
                    </div>
                    {isRefunded ? (
                      <div className="small" style={{ fontSize: 12 }}>
                        Pilot withdrew · <strong style={{ color: 'var(--coral)' }}>{points}</strong> pts returned to your balance
                      </div>
                    ) : (
                      <div className="small" style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--coral)' }}>{ordinal(place)}</span> · {points} pts → <strong style={{ color: 'var(--electric)' }}>{potential}</strong>
                      </div>
                    )}
                  </div>
                  {!locked && !isRefunded && (
                    <button onClick={() => removeBet(pilotId, Number(place))}
                      style={{ width: 28, height: 28, borderRadius: 'var(--r-pill)', background: 'var(--bg-tint)', color: 'var(--ink-mute)', fontSize: 16, fontWeight: 700 }} type="button">×</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* WILDCARD */}
      {comp.wildcard && !locked && (
        <section className="panel fade-up" style={{ background: 'linear-gradient(135deg, var(--violet), var(--violet-deep))', borderColor: 'var(--violet)', color: '#fff', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="kicker" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>FREE WILDCARD · +500 PTS</div>
              <h3 className="h2" style={{ color: '#fff', marginBottom: 6 }}>{comp.wildcard.question || 'Wildcard question'}</h3>
              <p className="small" style={{ color: 'rgba(255,255,255,0.8)' }}>{comp.wildcard.description || 'No cost to enter. Correct answer wins bonus points.'}</p>
            </div>
            <div style={{ minWidth: 200 }}>
              <input
                className="input"
                style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                value={wildcardPick}
                placeholder={comp.wildcard.placeholder || 'Your guess'}
                onChange={e => setWildcardPick(e.target.value)}
              />
            </div>
          </div>
        </section>
      )}

      {/* LIVE TRACKER (provisional standings + updates feed) */}
      {comp.dailyUpdates && comp.dailyUpdates.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--lime)' }} />
              <h2 className="h2-display">Live Updates</h2>
            </div>
            <span className="small">{comp.dailyUpdates.length} {comp.dailyUpdates.length === 1 ? 'update' : 'updates'}</span>
          </div>
          <div className="updates-feed">
            {comp.dailyUpdates.slice(0, 5).map(u => (
              <div key={u.id} className="update-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div>
                    {u.day && <span className="kicker" style={{ color: 'var(--lime)', marginRight: 8 }}>{u.day}</span>}
                    <strong style={{ color: 'var(--ink)' }}>{u.title}</strong>
                  </div>
                  <span className="small" style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
                    {new Date(u.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {u.body && <p className="small" style={{ color: 'var(--ink-soft)' }}>{u.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {comp.provisionalResults && Object.keys(comp.provisionalResults).length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--lime)' }} />
              <h2 className="h2-display">Provisional Standings</h2>
            </div>
            <span className="small">Updates as the event progresses</span>
          </div>
          <div className="standings-list">
            {Object.entries(comp.provisionalResults)
              .map(([pilotId, place]) => {
                const pilot = comp.competitors?.find(c => c.id === pilotId);
                return pilot ? { ...pilot, place: Number(place) } : null;
              })
              .filter(Boolean)
              .sort((a, b) => a.place - b.place)
              .map(p => (
                <div key={p.id} className="standing-row">
                  <span className="standing-place">{ordinal(p.place)}</span>
                  {p.photo ? <img src={p.photo} alt="" className="standing-photo" /> : <div className="standing-photo standing-photo-placeholder">?</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="standing-name">{p.name}</div>
                    {p.balloon && <div className="small" style={{ fontStyle: 'italic' }}>"{p.balloon}"</div>}
                  </div>
                  <span className="small" style={{ color: 'var(--ink-mute)' }}>Banner #{p.number}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* THE FIELD */}
      <div className="section-head">
        <div className="section-title">
          <div className="section-bar" style={{ background: 'var(--electric)' }} />
          <h2 className="h2-display">The Field</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            className="select field-sort"
            value={fieldSort}
            onChange={(e) => setFieldSort(e.target.value)}
          >
            <option value="banner">Sort: Banner #</option>
            <option value="bestOdds">Sort: Best Odds First</option>
            <option value="worstOdds">Sort: Longshots First</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
          <span className="small">{comp.competitors?.length || 0} pilots</span>
        </div>
      </div>

      {(!comp.competitors || comp.competitors.length === 0) ? (
        <div className="empty">
          <div className="empty-icon">🎈</div>
          <div className="empty-title">No pilots yet</div>
        </div>
      ) : (
        <div className="pilot-grid">
          {sortedCompetitors.map((p, i) => {
            const winOdds = p.oddsByPlace?.[1] || 0;
            const picksOnThisPilot = Object.entries(bets).filter(([k, v]) => {
              if (!k.startsWith(p.id + ':')) return false;
              const status = typeof v === 'object' ? v.status : 'pending';
              return status !== 'refunded';
            }).length;
            const isWithdrawn = !!p.withdrawn;
            return (
              <button
                key={p.id}
                onClick={() => !locked && !isWithdrawn && setSelectedPilot(p)}
                className={`pilot-card fade-up ${isWithdrawn ? 'pilot-card-withdrawn' : ''}`}
                style={{
                  animationDelay: `${i * 0.02}s`,
                  textAlign: 'left',
                  cursor: (locked || isWithdrawn) ? 'default' : 'pointer',
                  ...(picksOnThisPilot > 0 && !isWithdrawn ? { borderColor: 'var(--electric)', boxShadow: '0 0 0 1.5px var(--electric), var(--shadow-md)' } : {}),
                }}
                disabled={locked || isWithdrawn}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  {p.photo ? (
                    <img src={p.photo} alt="" style={{ width: 72, height: 72, borderRadius: 'var(--r-md)', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 'var(--r-md)', background: 'var(--bg-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--display)', fontSize: 28, color: 'var(--ink-mute)' }}>?</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span className="pilot-rank">Banner #{p.number || (i + 1)}</span>
                      {isWithdrawn ? (
                        <span className="tag" style={{ background: 'var(--red-wash)', color: 'var(--red)' }}>WITHDRAWN</span>
                      ) : picksOnThisPilot > 0 && (
                        <span className="tag" style={{ background: 'var(--electric-wash)', color: 'var(--electric)' }}>
                          {picksOnThisPilot} pick{picksOnThisPilot > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="pilot-name" style={{ marginTop: 2 }}>{p.name}</div>
                    {p.balloon && <div className="pilot-balloon">"{p.balloon}"</div>}
                  </div>
                </div>

                {p.balloonPhoto && (
                  <div style={{
                    height: 90, borderRadius: 'var(--r-md)', overflow: 'hidden',
                    backgroundImage: `url(${p.balloonPhoto})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }} />
                )}

                <div className="odds-block">
                  <div>
                    <div className="odds-label">Win Odds</div>
                    {p.world && <div style={{ fontSize: 10, color: 'var(--sky-deep)', fontWeight: 600, marginTop: 2 }}>World #{p.world}{p.us ? ` · US #${p.us}` : ''}</div>}
                  </div>
                  <span className="odds-val">{winOdds}×</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* BOTTOM ACTION BAR */}
      {!locked && (
        <div className="wager-bar">
          <div className="wager-bar-stats">
            <div className="stat">
              <span className="lbl">Wagered</span>
              <span className="val">{totalWagered}</span>
            </div>
            <div className="stat">
              <span className="lbl">Remaining</span>
              <span className="val" style={{ color: remaining < 0 ? 'var(--coral)' : 'var(--sky)' }}>{remaining}</span>
            </div>
          </div>
          <button className="btn btn-sky btn-lg" onClick={save} disabled={saving || Object.keys(bets).length === 0}>
            {saving ? 'Saving…' : `Place Picks →`}
          </button>
        </div>
      )}

      {/* PICK SHEET (modal-like overlay) */}
      {selectedPilot && (
        <PickSheet
          pilot={selectedPilot}
          competitors={comp.competitors}
          selectedPlace={selectedPlace}
          setSelectedPlace={setSelectedPlace}
          pointInput={pointInput}
          setPointInput={setPointInput}
          existingBet={bets[`${selectedPilot.id}:${selectedPlace}`] || 0}
          remaining={remaining + (() => {
            const existing = bets[`${selectedPilot.id}:${selectedPlace}`];
            if (!existing) return 0;
            return typeof existing === 'object' ? (existing.points || 0) : (Number(existing) || 0);
          })()}
          onConfirm={addBet}
          onCancel={() => setSelectedPilot(null)}
        />
      )}
    </div>
  );
}

function PickSheet({ pilot, selectedPlace, setSelectedPlace, pointInput, setPointInput, existingBet, remaining, onConfirm, onCancel, competitors }) {
  const nPilots = competitors.length;
  const oddsAtPlace = pilot.oddsByPlace?.[selectedPlace] || 0;
  const potential = Math.round(pointInput * oddsAtPlace);

  // Track the points input as a string so users can clear it / type freely.
  const [pointStr, setPointStr] = useState(String(pointInput || ''));
  // Keep local state in sync if pointInput changes from outside (preset buttons)
  useEffect(() => { setPointStr(pointInput === 0 ? '' : String(pointInput)); }, [pointInput]);

  // Show ALL places 1 through N as selectable buttons - no "smart pick" filter
  const allPlaces = useMemo(() => {
    return Array.from({ length: nPilots }, (_, i) => i + 1);
  }, [nPilots]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(22, 24, 29, 0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 90,
      animation: 'fadeUp 0.2s',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="pick-sheet" style={{
        background: 'var(--surface)', width: '100%', maxWidth: 560,
        borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: 24, paddingBottom: 28,
        boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            {pilot.photo ? (
              <img src={pilot.photo} alt="" style={{ width: 56, height: 56, borderRadius: 'var(--r-md)', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 'var(--r-md)', background: 'var(--bg-tint)' }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="kicker" style={{ color: 'var(--ink-mute)', marginBottom: 2 }}>PICKING</div>
              <h3 className="h2" style={{ fontSize: 22 }}>{pilot.name}</h3>
              {pilot.balloon && <div className="small" style={{ fontFamily: 'var(--display)', fontStyle: 'italic' }}>"{pilot.balloon}"</div>}
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 36, height: 36, borderRadius: 'var(--r-pill)', background: 'var(--bg-tint)', fontSize: 20, fontWeight: 600 }} type="button">×</button>
        </div>

        <div className="field">
          <label>Predicted Finishing Place</label>
          <div className="place-grid">
            {allPlaces.map(p => (
              <button key={p}
                type="button"
                onClick={() => setSelectedPlace(p)}
                className={`place-btn ${selectedPlace === p ? 'active' : ''}`}>
                <span className="place-num">{p}</span>
                <span className="place-suffix">{ordinalSuffix(p)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Points to Wager (max {remaining} available)</label>
          <div className="bet-stepper">
            <button
              type="button"
              onClick={() => setPointInput(Math.max(0, pointInput - 10))}
            >–</button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pointStr}
              placeholder="0"
              onChange={e => {
                // Allow only digits
                const cleaned = e.target.value.replace(/[^0-9]/g, '');
                // Strip leading zeros unless the field is just "0"
                const noLeadingZeros = cleaned.replace(/^0+(?=\d)/, '');
                setPointStr(noLeadingZeros);
                // Update the actual number for downstream calculations
                const n = noLeadingZeros === '' ? 0 : Math.min(remaining, Number(noLeadingZeros));
                setPointInput(n);
                // If they typed past the max, snap the visible string to match
                if (noLeadingZeros !== '' && Number(noLeadingZeros) > remaining) {
                  setPointStr(String(remaining));
                }
              }}
              onFocus={e => e.target.select()}
            />
            <button
              type="button"
              onClick={() => setPointInput(Math.min(remaining, pointInput + 10))}
            >+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[25, 50, 100, 250].filter(v => v <= remaining).map(v => (
              <button key={v} type="button" onClick={() => setPointInput(v)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>{v}</button>
            ))}
            {remaining > 0 && (
              <button type="button" onClick={() => setPointInput(remaining)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>All ({remaining})</button>
            )}
          </div>
        </div>

        <div style={{
          background: 'var(--electric-wash)', borderRadius: 'var(--r-md)',
          padding: '14px 16px', marginTop: 16, marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div className="kicker" style={{ color: 'var(--electric)', marginBottom: 4 }}>If Correct</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 36, color: 'var(--electric)', lineHeight: 0.95 }}>
              {potential.toLocaleString()}
            </div>
            <div className="small">points back ({oddsAtPlace}× odds)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>If Wrong</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--ink-mute)' }}>0</div>
            <div className="small">exact-only</div>
          </div>
        </div>

        <button className="btn btn-electric btn-lg" style={{ width: '100%' }} onClick={onConfirm} disabled={pointInput <= 0}>
          {existingBet > 0 ? `Update Pick (${existingBet} → ${pointInput} pts)` : `Lock In ${pointInput} pts on ${ordinal(selectedPlace)}`}
        </button>
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}
