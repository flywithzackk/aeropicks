import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';

export default function Admin() {
  const [tab, setTab] = useState('competitions');
  return (
    <div>
      <section className="hero" style={{ paddingBottom: 28, marginBottom: 28 }}>
        <div className="eyebrow fade-up">
          <span className="dot" style={{ background: 'var(--violet)' }} />
          Administrator Console
        </div>
        <h1 className="display fade-up" style={{ animationDelay: '0.07s' }}>
          Mission <span style={{ color: 'var(--violet)' }}>control.</span>
        </h1>
      </section>

      <div className="tabs">
        {[
          { id: 'competitions', label: 'Competitions' },
          { id: 'roster', label: 'Pilots & Odds' },
          { id: 'results', label: 'Results' },
          { id: 'users', label: 'Users' },
        ].map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'competitions' && <CompetitionsTab />}
      {tab === 'roster' && <RosterTab />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

/* ============ COMPETITIONS TAB ============ */
function CompetitionsTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comps, setComps] = useState([]);
  const [form, setForm] = useState({
    name: 'Rio Grande Classic 2026', location: 'Rio Rancho, NM',
    dates: '', eventLevel: 'state', description: '', status: 'draft',
    wildcard: null,
  });
  const [editingId, setEditingId] = useState(null);
  const [editingWildcard, setEditingWildcard] = useState(false);

  const load = () => authFetch('/api/competitions').then(r => r.json()).then(d => setComps(d.competitions || []));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/competitions', {
      method: 'POST',
      body: JSON.stringify({ ...form, id: editingId }),
    });
    if (res.ok) {
      showToast(editingId ? 'Updated' : 'Competition created');
      setForm({ name: '', location: '', dates: '', eventLevel: 'state', description: '', status: 'draft', wildcard: null });
      setEditingId(null);
      setEditingWildcard(false);
      load();
    } else showToast('Save failed', 'error');
  };

  const remove = async (id) => {
    if (!confirm('Delete this competition? This removes all bets too.')) return;
    const res = await authFetch(`/api/competitions?id=${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Deleted'); load(); }
  };

  const edit = async (c) => {
    // Fetch full record to get wildcard
    const full = await authFetch(`/api/competitions?id=${c.id}`).then(r => r.json());
    const comp = full.competition;
    setForm({
      name: comp.name, location: comp.location || '', dates: comp.dates || '',
      eventLevel: comp.eventLevel || 'state', description: comp.description || '',
      status: comp.status || 'draft', wildcard: comp.wildcard || null,
    });
    setEditingId(comp.id);
    setEditingWildcard(!!comp.wildcard);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setStatus = async (c, status) => {
    const full = await authFetch(`/api/competitions?id=${c.id}`).then(r => r.json());
    const res = await authFetch('/api/competitions', { method: 'POST', body: JSON.stringify({ ...full.competition, status }) });
    if (res.ok) { showToast(`Marked ${status}`); load(); }
  };

  const seed = async () => {
    if (!confirm('Seed Rio Grande Classic 2026 with all 31 pilots, photos, balloon photos, and calculated odds?')) return;
    const res = await authFetch('/api/seed-rgc', { method: 'POST' });
    const data = await res.json();
    if (res.ok) { showToast(`Seeded ${data.pilotCount} pilots`); load(); }
    else showToast(data.error || 'Seed failed', 'error');
  };

  const updateWildcard = (field, value) => {
    setForm(f => ({ ...f, wildcard: { ...(f.wildcard || {}), [field]: value } }));
  };

  return (
    <div>
      <div className="panel fade-up" style={{ background: 'var(--violet)', borderColor: 'var(--violet)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="kicker" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Quick Start</div>
          <h2 className="h2" style={{ color: '#fff' }}>Seed Rio Grande Classic 2026</h2>
          <p className="small" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            31 pilots with photos, balloon photos, rankings, history, and calculated odds.
          </p>
        </div>
        <button className="btn" style={{ background: '#fff', color: 'var(--violet)' }} onClick={seed}>Seed Now</button>
      </div>

      <div className="panel fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="panel-head">
          <h2 className="h2">{editingId ? 'Edit Competition' : 'New Competition'}</h2>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditingWildcard(false); setForm({ name: '', location: '', dates: '', eventLevel: 'state', description: '', status: 'draft', wildcard: null }); }}>
              Cancel
            </button>
          )}
        </div>
        <form onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Event Level</label>
              <select className="select" value={form.eventLevel} onChange={e => setForm({ ...form, eventLevel: e.target.value })}>
                <option value="state">State / Regional</option>
                <option value="national">National Championship</option>
                <option value="world">World Championship</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Location</label>
              <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="field">
              <label>Dates</label>
              <input className="input" value={form.dates} onChange={e => setForm({ ...form, dates: e.target.value })} placeholder="October 4–12, 2026" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Status</label>
              <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft — hidden</option>
                <option value="live">Live — picks open</option>
                <option value="locked">Locked — no new picks</option>
                <option value="settled">Settled — results in</option>
              </select>
            </div>
            <div className="field">
              <label>Description</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          {/* Wildcard configurator */}
          <div className="field" style={{ marginTop: 8, background: 'var(--violet-wash)', padding: 18, borderRadius: 'var(--r-md)', border: '1.5px solid var(--violet)' }}>
            <label style={{ color: 'var(--violet)' }}>
              <input type="checkbox" checked={editingWildcard} onChange={e => { setEditingWildcard(e.target.checked); if (!e.target.checked) setForm(f => ({ ...f, wildcard: null })); else if (!form.wildcard) setForm(f => ({ ...f, wildcard: { question: '', description: '', placeholder: '', answerType: 'text' } })); }}
                style={{ marginRight: 6, transform: 'scale(1.2)' }} />
              Include a Wildcard bet (free guess for bonus points)
            </label>
            {editingWildcard && form.wildcard && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <input className="input" placeholder="Wildcard question (e.g. Who finishes 20th?)"
                  value={form.wildcard.question || ''} onChange={e => updateWildcard('question', e.target.value)} />
                <input className="input" placeholder="Sub-description"
                  value={form.wildcard.description || ''} onChange={e => updateWildcard('description', e.target.value)} />
                <input className="input" placeholder="Input placeholder (e.g. 'Pilot name')"
                  value={form.wildcard.placeholder || ''} onChange={e => updateWildcard('placeholder', e.target.value)} />
              </div>
            )}
          </div>

          <button className="btn btn-violet" type="submit" style={{ marginTop: 8 }}>{editingId ? 'Save Changes' : 'Create Competition'}</button>
        </form>
      </div>

      <div className="panel fade-up" style={{ animationDelay: '0.1s', padding: 0, overflow: 'hidden' }}>
        <div className="panel-head" style={{ padding: '22px 24px', marginBottom: 0 }}>
          <h2 className="h2">All Competitions</h2>
          <span className="small">{comps.length} total</span>
        </div>
        {comps.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No competitions yet</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Name</th>
                  <th>Level</th>
                  <th>Pilots</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {comps.map(c => (
                  <tr key={c.id}>
                    <td className="cell-name" style={{ paddingLeft: 24 }}>
                      {c.name}
                      <div className="small" style={{ marginTop: 2 }}>{c.location} {c.dates ? `· ${c.dates}` : ''}</div>
                    </td>
                    <td><span className="tag" style={{ background: 'var(--violet-wash)', color: 'var(--violet)' }}>{c.eventLevel || 'state'}</span></td>
                    <td style={{ fontFamily: 'var(--display)', fontSize: 18 }}>{c.competitorCount ?? 0}</td>
                    <td><span className={`tag tag-${c.status === 'settled' ? 'locked' : c.status}`}>{c.status}</span></td>
                    <td style={{ textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => edit(c)} style={{ marginRight: 6 }}>Edit</button>
                      {c.status === 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(c, 'live')} style={{ marginRight: 6 }}>Open</button>}
                      {c.status === 'live' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(c, 'locked')} style={{ marginRight: 6 }}>Lock</button>}
                      {c.status === 'locked' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(c, 'live')} style={{ marginRight: 6 }}>Reopen</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)} style={{ color: 'var(--red)', borderColor: 'var(--red-wash)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ ROSTER TAB - pilots, odds, overrides ============ */
function RosterTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comps, setComps] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [competition, setCompetition] = useState(null);
  const [expandedPilot, setExpandedPilot] = useState(null);

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      setComps(d.competitions || []);
      if (!selectedId && d.competitions?.length) setSelectedId(d.competitions[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) { setCompetition(null); return; }
    authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => setCompetition(d.competition));
  }, [selectedId]);

  const reload = () => {
    if (!selectedId) return;
    authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => setCompetition(d.competition));
  };

  const setOverride = async (pilotId, place, value) => {
    const pilot = competition.competitors.find(c => c.id === pilotId);
    const current = pilot.overrideOdds || {};
    const next = { ...current };
    if (value === '' || value == null) {
      delete next[place];
    } else {
      next[place] = Number(value);
    }
    await authFetch('/api/competitors', {
      method: 'PATCH',
      body: JSON.stringify({ competitionId: selectedId, competitorId: pilotId, overrideOdds: Object.keys(next).length === 0 ? null : next }),
    });
    reload();
  };

  return (
    <div>
      <div className="panel fade-up">
        <div className="panel-head">
          <h2 className="h2">Select Competition</h2>
          <select className="select" style={{ maxWidth: 320 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— Select —</option>
            {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {competition && (
          <p className="small">
            Event level: <strong>{competition.eventLevel}</strong>.
            Odds are calculated automatically. Click a pilot to override their odds at any position.
          </p>
        )}
      </div>

      {competition && (
        <div className="panel fade-up" style={{ animationDelay: '0.05s', padding: 0, overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '22px 24px', marginBottom: 0 }}>
            <h2 className="h2">{competition.name} — Roster</h2>
            <span className="small">{competition.competitors?.length || 0} pilots</span>
          </div>
          {(!competition.competitors || competition.competitors.length === 0) ? (
            <div className="empty"><div className="empty-icon">🎈</div><div className="empty-title">No pilots loaded</div><p className="small">Use "Seed RGC" on the Competitions tab.</p></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>#</th>
                    <th>Pilot</th>
                    <th>Rankings</th>
                    <th>Skill</th>
                    <th>Top 10%</th>
                    <th>Win Odds (1st)</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...competition.competitors].sort((a, b) => (b.skillScore || 0) - (a.skillScore || 0)).map(p => {
                    const override = p.overrideOdds?.[1];
                    const algoOdds = p.oddsByPlace?.[1];
                    const isExpanded = expandedPilot === p.id;
                    const rows = [
                      <tr key={p.id}>
                          <td style={{ paddingLeft: 24, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{p.number}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {p.photo ? <img src={p.photo} style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--bg-tint)' }} />}
                              <div>
                                <div className="cell-name">{p.name}</div>
                                {p.balloon && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>"{p.balloon}"</div>}
                              </div>
                            </div>
                          </td>
                          <td className="small">
                            {p.world ? `W#${p.world}` : '—'} {p.us ? `· US#${p.us}` : ''}
                          </td>
                          <td style={{ fontFamily: 'var(--display)', fontSize: 18 }}>{p.skillScore?.toFixed(0)}</td>
                          <td className="mono"><strong style={{ color: 'var(--electric)' }}>{p.top10Pct}%</strong></td>
                          <td>
                            <span className="mono" style={{ fontWeight: 600, color: override ? 'var(--coral)' : 'var(--ink)' }}>
                              {override ?? algoOdds}×
                            </span>
                            {override !== undefined && override !== null && <span className="small" style={{ marginLeft: 6 }}>(override)</span>}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 24 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setExpandedPilot(isExpanded ? null : p.id)}>
                              {isExpanded ? 'Close' : 'Override Odds'}
                            </button>
                          </td>
                        </tr>
                    ];
                    if (isExpanded) {
                      rows.push(
                        <tr key={p.id + '-expanded'}>
                            <td colSpan={7} style={{ paddingLeft: 24, background: 'var(--surface-2)' }}>
                              <div style={{ padding: '14px 0' }}>
                                <div className="kicker" style={{ marginBottom: 10 }}>Override odds for {p.name} at any place (leave blank for algorithm default)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                                  {[1,2,3,4,5,6,7,8,9,10,15,20,25,30].map(place => (
                                    <div key={place} style={{ background: 'var(--surface)', padding: 8, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                                      <div className="kicker" style={{ marginBottom: 4 }}>{ordinal(place)}</div>
                                      <input
                                        className="input"
                                        style={{ padding: '6px 8px', fontSize: 13, fontFamily: 'var(--mono)', textAlign: 'center', fontWeight: 600 }}
                                        defaultValue={p.overrideOdds?.[place] ?? ''}
                                        placeholder={String(p.oddsByPlace?.[place] || '—')}
                                        onBlur={e => setOverride(p.id, place, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ RESULTS TAB - enter finishing places, settle ============ */
function ResultsTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comps, setComps] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [competition, setCompetition] = useState(null);
  const [results, setResults] = useState({}); // pilotId -> place
  const [wildcardWinner, setWildcardWinner] = useState('');
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      setComps((d.competitions || []).filter(c => c.status === 'locked' || c.status === 'settled'));
    });
  }, []);

  useEffect(() => {
    if (!selectedId) { setCompetition(null); return; }
    authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => {
      setCompetition(d.competition);
      setResults(d.competition?.results || {});
      setWildcardWinner(d.competition?.wildcardWinner || '');
    });
  }, [selectedId]);

  const settle = async () => {
    if (!competition) return;
    const placeCount = Object.values(results).filter(v => v).length;
    if (placeCount === 0) {
      showToast('Enter at least one finishing place', 'error');
      return;
    }
    if (!confirm(`Settle ${competition.name}? This pays out winners and cannot be re-bet.`)) return;
    setSettling(true);
    const res = await authFetch('/api/settle', {
      method: 'POST',
      body: JSON.stringify({
        competitionId: selectedId,
        results,
        wildcardWinner: wildcardWinner || null,
      }),
    });
    setSettling(false);
    const data = await res.json();
    if (res.ok) {
      showToast(`Settled — ${data.membersPaid} members paid · ${data.totalPaidOut.toLocaleString()} pts`);
      authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => setCompetition(d.competition));
    } else {
      showToast(data.error || 'Settlement failed', 'error');
    }
  };

  const revert = async () => {
    if (!confirm('Revert this settlement? All paid-out points will be clawed back from members. Use only if results were entered wrong.')) return;
    setSettling(true);
    const res = await authFetch('/api/settle', {
      method: 'POST',
      body: JSON.stringify({ competitionId: selectedId, revert: true }),
    });
    setSettling(false);
    if (res.ok) {
      showToast('Reverted');
      authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => setCompetition(d.competition));
    } else {
      const data = await res.json();
      showToast(data.error || 'Revert failed', 'error');
    }
  };

  return (
    <div>
      <div className="panel fade-up">
        <div className="panel-head">
          <h2 className="h2">Enter Results</h2>
          <select className="select" style={{ maxWidth: 320 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— Select a locked competition —</option>
            {comps.map(c => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
          </select>
        </div>
        <p className="small">
          Only locked or settled competitions appear here. Enter each pilot's finishing place, then click "Settle" to pay out members.
        </p>
      </div>

      {competition && (
        <>
          {competition.status === 'settled' && (
            <div className="panel" style={{ background: 'var(--lime-wash)', borderColor: 'var(--lime)', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: 'var(--lime)' }}>Settled.</strong>
                <span className="small" style={{ marginLeft: 8 }}>Settled at {new Date(competition.settledAt).toLocaleString()}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={revert} style={{ color: 'var(--red)', borderColor: 'var(--red-wash)' }} disabled={settling}>
                Revert Settlement
              </button>
            </div>
          )}

          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-head" style={{ padding: '22px 24px', marginBottom: 0 }}>
              <h2 className="h2">{competition.name} — Finishing Places</h2>
              <span className="small">{Object.values(results).filter(v => v).length} of {competition.competitors?.length || 0} entered</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>#</th>
                    <th>Pilot</th>
                    <th style={{ width: 140 }}>Finishing Place</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.competitors.map(p => (
                    <tr key={p.id}>
                      <td style={{ paddingLeft: 24, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{p.number}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.photo ? <img src={p.photo} style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', objectFit: 'cover' }} /> : null}
                          <span className="cell-name">{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number" min="1" max={competition.competitors.length}
                          className="input"
                          style={{ padding: '6px 10px', fontFamily: 'var(--display)', fontSize: 18, textAlign: 'center' }}
                          value={results[p.id] || ''}
                          onChange={e => setResults(r => ({ ...r, [p.id]: e.target.value ? Number(e.target.value) : null }))}
                          disabled={competition.status === 'settled'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {competition.wildcard && (
            <div className="panel" style={{ background: 'var(--violet-wash)', borderColor: 'var(--violet)' }}>
              <div className="kicker" style={{ color: 'var(--violet)', marginBottom: 8 }}>WILDCARD</div>
              <h3 className="h3">{competition.wildcard.question}</h3>
              <p className="small" style={{ marginTop: 4, marginBottom: 12 }}>{competition.wildcard.description}</p>
              <input
                className="input"
                placeholder="Correct answer"
                value={wildcardWinner}
                onChange={e => setWildcardWinner(e.target.value)}
                disabled={competition.status === 'settled'}
              />
            </div>
          )}

          {competition.status !== 'settled' && (
            <button className="btn btn-violet btn-lg" onClick={settle} disabled={settling} style={{ marginTop: 16 }}>
              {settling ? 'Settling…' : 'Settle Competition →'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ============ USERS TAB ============ */
function UsersTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const load = () => {
    authFetch('/api/users').then(r => r.json()).then(d => {
      setUsers(d.users || []); setNote(d.error || ''); setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetPassword = async (email) => {
    const res = await authFetch('/api/users', { method: 'POST', body: JSON.stringify({ action: 'recover', email }) });
    if (res.ok) showToast(`Reset sent to ${email}`);
    else showToast('Reset failed', 'error');
  };

  const toggleAdmin = async (u) => {
    const isAdmin = u.app_metadata?.roles?.includes('admin');
    const res = await authFetch('/api/users', { method: 'POST', body: JSON.stringify({ action: 'setRole', userId: u.id, admin: !isAdmin }) });
    if (res.ok) { showToast(isAdmin ? 'Admin revoked' : 'Admin granted'); load(); }
  };

  return (
    <div className="panel fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="panel-head" style={{ padding: '22px 24px', marginBottom: 0 }}>
        <h2 className="h2">Members</h2>
        <span className="small">{users.length} total</span>
      </div>
      {loading && <div style={{ padding: 50 }}><div className="spinner" /></div>}
      {!loading && users.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No members to show</div>
          <p className="small">{note || 'User listing requires NETLIFY_IDENTITY_TOKEN env var.'}</p>
        </div>
      )}
      {users.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 24 }}>Email</th>
                <th>Joined</th>
                <th>Role</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isAdmin = u.app_metadata?.roles?.includes('admin');
                return (
                  <tr key={u.id}>
                    <td className="cell-name" style={{ paddingLeft: 24 }}>{u.email}</td>
                    <td className="small">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>{isAdmin
                      ? <span className="tag" style={{ background: 'var(--violet-wash)', color: 'var(--violet)' }}>Admin</span>
                      : <span className="small">Member</span>}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u.email)} style={{ marginRight: 6 }}>Reset PW</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleAdmin(u)}>{isAdmin ? 'Revoke' : 'Make Admin'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
