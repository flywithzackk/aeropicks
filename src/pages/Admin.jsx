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
          { id: 'tracker', label: 'Live Tracker' },
          { id: 'results', label: 'Results' },
          { id: 'users', label: 'Users' },
          { id: 'simulator', label: 'Simulator' },
        ].map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'competitions' && <CompetitionsTab />}
      {tab === 'roster' && <RosterTab />}
      {tab === 'tracker' && <TrackerTab />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'simulator' && <SimulatorTab />}
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
    wildcard: null, logoImage: null, bannerImage: null,
  });
  const [editingId, setEditingId] = useState(null);
  const [editingWildcard, setEditingWildcard] = useState(false);

  const load = () => authFetch('/api/competitions').then(r => r.json()).then(d => setComps(d.competitions || []));
  useEffect(() => { load(); }, []);

  const uploadImage = async (file) => {
    if (!file) return null;
    if (file.size > 4 * 1024 * 1024) { showToast('Image too large (max 4MB)', 'error'); return null; }
    const dataUrl = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = (ev) => res(ev.target.result);
      reader.readAsDataURL(file);
    });
    const r = await fetch('/api/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl }),
    });
    const data = await r.json();
    return r.ok ? data.url : null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/competitions', {
      method: 'POST',
      body: JSON.stringify({ ...form, id: editingId }),
    });
    if (res.ok) {
      showToast(editingId ? 'Updated' : 'Competition created');
      setForm({ name: '', location: '', dates: '', eventLevel: 'state', description: '', status: 'draft', wildcard: null, logoImage: null, bannerImage: null });
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
      logoImage: comp.logoImage || null, bannerImage: comp.bannerImage || null,
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
      {/* Top action bar */}
      <div className="comp-action-bar fade-up">
        <button
          className="btn btn-violet btn-lg"
          type="button"
          onClick={() => {
            setEditingId(null);
            setEditingWildcard(false);
            setForm({ name: '', location: '', dates: '', eventLevel: 'state', description: '', status: 'draft', wildcard: null, logoImage: null, bannerImage: null });
            setTimeout(() => {
              const form = document.getElementById('comp-form-panel');
              if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }}
        >
          + New Competition
        </button>
        <button className="btn btn-ghost" type="button" onClick={seed}>Quick Seed: RGC 2026</button>
      </div>

      <div id="comp-form-panel" className="panel fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="panel-head">
          <h2 className="h2">{editingId ? 'Edit Competition' : 'New Competition'}</h2>
          {editingId && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditingWildcard(false); setForm({ name: '', location: '', dates: '', eventLevel: 'state', description: '', status: 'draft', wildcard: null, logoImage: null, bannerImage: null }); }}>
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
                <option value="upcoming">Upcoming — visible, picks closed</option>
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

          {/* Logo + Banner image uploads */}
          <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            <div>
              <label>Event Logo (square, ~400px)</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {form.logoImage ? (
                  <img src={form.logoImage} alt="" style={{ width: 64, height: 64, borderRadius: 'var(--r-md)', objectFit: 'cover', border: '1.5px solid var(--line)' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 'var(--r-md)', background: 'var(--bg-tint)', border: '1.5px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎈</div>
                )}
                <input type="file" accept="image/*" id="event-logo-upload" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadImage(file);
                    if (url) setForm(f => ({ ...f, logoImage: url }));
                  }} />
                <label htmlFor="event-logo-upload" className="btn btn-ghost btn-sm">Upload</label>
                {form.logoImage && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, logoImage: null }))}>Remove</button>
                )}
              </div>
            </div>
            <div>
              <label>Banner Image (wide, ~1200x400)</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {form.bannerImage ? (
                  <div style={{ width: 96, height: 48, borderRadius: 'var(--r-md)', backgroundImage: `url(${form.bannerImage})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1.5px solid var(--line)' }} />
                ) : (
                  <div style={{ width: 96, height: 48, borderRadius: 'var(--r-md)', background: 'var(--bg-tint)', border: '1.5px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>—</div>
                )}
                <input type="file" accept="image/*" id="event-banner-upload" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadImage(file);
                    if (url) setForm(f => ({ ...f, bannerImage: url }));
                  }} />
                <label htmlFor="event-banner-upload" className="btn btn-ghost btn-sm">Upload</label>
                {form.bannerImage && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, bannerImage: null }))}>Remove</button>
                )}
              </div>
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
                      {(c.competitorCount ?? 0) === 0 && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              if (!confirm(`Seed "${c.name}" with the 31 RGC pilots + photos + calculated odds?`)) return;
                              const res = await authFetch('/api/seed-rgc', {
                                method: 'POST',
                                body: JSON.stringify({ competitionId: c.id }),
                              });
                              const data = await res.json();
                              if (res.ok) { showToast(`Seeded ${data.pilotCount} pilots`); load(); }
                              else showToast(data.error || 'Seed failed', 'error');
                            }}
                            style={{ marginRight: 6, color: 'var(--violet)', borderColor: 'var(--violet)' }}
                          >Seed RGC</button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              const url = prompt(`Paste the WatchMeFly event URL for "${c.name}"\n\nExample: https://watchmefly.net/events/event.php?e=rgc2026`);
                              if (!url) return;
                              showToast('Importing pilots (this may take 30s)…');
                              const res = await authFetch('/api/scrape-watchmefly', {
                                method: 'POST',
                                body: JSON.stringify({ competitionId: c.id, url, fetchPhotos: true }),
                              });
                              const data = await res.json();
                              if (res.ok) { showToast(`Imported ${data.pilotCount} pilots`); load(); }
                              else showToast(data.error || 'Import failed', 'error');
                            }}
                            style={{ marginRight: 6, color: 'var(--sky)', borderColor: 'var(--sky)' }}
                          >Import from WatchMeFly</button>
                        </>
                      )}
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
                    const isWithdrawn = !!p.withdrawn;
                    const rows = [
                      <tr key={p.id} style={isWithdrawn ? { opacity: 0.55 } : {}}>
                          <td style={{ paddingLeft: 24 }}>
                            <input
                              type="text"
                              defaultValue={p.number || ''}
                              className="input"
                              style={{
                                width: 56,
                                padding: '6px 8px',
                                fontFamily: 'var(--mono)',
                                fontSize: 13,
                                textAlign: 'center',
                                background: 'var(--bg-tint)',
                              }}
                              onBlur={async (e) => {
                                const newNum = e.target.value.trim();
                                if (newNum === (p.number || '')) return;
                                const res = await authFetch('/api/competitors', {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    competitionId: selectedId,
                                    competitorId: p.id,
                                    number: newNum,
                                  }),
                                });
                                if (res.ok) {
                                  showToast(`Banner # updated to ${newNum}`);
                                  reload();
                                } else {
                                  showToast('Update failed', 'error');
                                  e.target.value = p.number || '';
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                                if (e.key === 'Escape') { e.target.value = p.number || ''; e.target.blur(); }
                              }}
                              title="Banner / basket number — click to edit"
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {p.photo ? <img src={p.photo} style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--bg-tint)' }} />}
                              <div>
                                <div className="cell-name">
                                  {p.name}
                                  {isWithdrawn && <span className="tag" style={{ background: 'var(--red-wash)', color: 'var(--red)', marginLeft: 8, fontSize: 9 }}>WITHDRAWN</span>}
                                </div>
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
                          <td style={{ textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setExpandedPilot(isExpanded ? null : p.id)} style={{ marginRight: 6 }}>
                              {isExpanded ? 'Close' : 'Override Odds'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: isWithdrawn ? 'var(--ink-soft)' : 'var(--red)', borderColor: isWithdrawn ? 'var(--line)' : 'var(--red-wash)' }}
                              onClick={async () => {
                                const next = !isWithdrawn;
                                if (next && !confirm(`Mark ${p.name} as withdrawn? All bets on this pilot will be refunded to members' per-competition balance.`)) return;
                                if (!next && !confirm(`Un-mark ${p.name} as withdrawn? (This does NOT re-apply the previously refunded bets.)`)) return;
                                const res = await authFetch('/api/withdraw-pilot', {
                                  method: 'POST',
                                  body: JSON.stringify({ competitionId: competition.id, pilotId: p.id, withdrawn: next }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  showToast(next ? `${p.name} withdrawn · ${data.refundsIssued} bets refunded` : `${p.name} re-instated`);
                                  reload();
                                } else {
                                  showToast(data.error || 'Failed', 'error');
                                }
                              }}
                            >
                              {isWithdrawn ? 'Un-withdraw' : 'Withdraw'}
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
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // userId of expanded row
  const [memberDetail, setMemberDetail] = useState({}); // { userId: { member, bets } }

  const load = () => {
    authFetch('/api/admin-members').then(r => r.json()).then(d => {
      setMembers(d.members || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleExpand = async (userId) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (!memberDetail[userId]) {
      const r = await authFetch(`/api/admin-members?userId=${userId}`);
      const d = await r.json();
      if (r.ok) setMemberDetail(prev => ({ ...prev, [userId]: d }));
    }
  };

  if (loading) return <div className="panel"><div className="spinner" /></div>;

  const realMembers = members.filter(m => !m.simulated);
  const simMembers = members.filter(m => m.simulated);

  return (
    <div className="panel fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="panel-head" style={{ padding: '22px 24px', marginBottom: 0 }}>
        <h2 className="h2">Members</h2>
        <span className="small">{realMembers.length} real · {simMembers.length} simulated</span>
      </div>
      {members.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No members yet</div>
          <p className="small">Members will appear here after they sign up.</p>
        </div>
      ) : (
        <div className="members-list">
          {members.map(m => (
            <div key={m.userId} className={`member-row ${m.simulated ? 'member-sim' : ''}`}>
              <button className="member-summary" onClick={() => toggleExpand(m.userId)} type="button">
                {m.photo ? (
                  <img src={m.photo} alt="" className="member-photo" />
                ) : (
                  <div className="member-photo member-photo-initial">{m.username?.[0]?.toUpperCase() || '?'}</div>
                )}
                <div className="member-info">
                  <div className="member-name">
                    {m.username}
                    {m.simulated && <span className="tag" style={{ background: 'var(--bg-tint)', color: 'var(--ink-mute)', marginLeft: 8, fontSize: 10 }}>SIM</span>}
                  </div>
                  <div className="small" style={{ color: 'var(--ink-mute)' }}>{m.email}</div>
                </div>
                <div className="member-stats">
                  <div>
                    <span className="member-stat-num" style={{ color: 'var(--lime)' }}>{m.totalWon.toLocaleString()}</span>
                    <span className="member-stat-label">won</span>
                  </div>
                  <div>
                    <span className="member-stat-num">{m.betCount}</span>
                    <span className="member-stat-label">picks</span>
                  </div>
                </div>
                <span className="member-expand-icon">{expanded === m.userId ? '▾' : '▸'}</span>
              </button>
              {expanded === m.userId && memberDetail[m.userId] && (
                <div className="member-detail">
                  <h4 className="kicker" style={{ marginBottom: 12, color: 'var(--sky)' }}>Picks ({memberDetail[m.userId].bets.length})</h4>
                  {memberDetail[m.userId].bets.length === 0 ? (
                    <p className="small">No picks placed yet.</p>
                  ) : (
                    <div className="member-bets-table">
                      {memberDetail[m.userId].bets.map((b, i) => (
                        <div key={i} className={`member-bet member-bet-${b.status}`}>
                          {b.pilotPhoto ? <img src={b.pilotPhoto} alt="" className="member-bet-photo" /> : <div className="member-bet-photo member-bet-photo-placeholder">?</div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{b.pilotName}</div>
                            <div className="small">{b.competitionName} · {ordinal(b.place)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--display)', fontSize: 18, color: b.status === 'won' ? 'var(--lime)' : b.status === 'lost' ? 'var(--ink-mute)' : 'var(--electric)' }}>
                              {b.status === 'won' ? `+${b.payout}` : b.points}
                            </div>
                            <div className="small" style={{ fontSize: 10 }}>@ {b.odds}× · {b.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
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

/* ============ LIVE TRACKER TAB ============ */
function TrackerTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comps, setComps] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [comp, setComp] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [provisional, setProvisional] = useState({});
  const [newUpdate, setNewUpdate] = useState({ day: '', title: '', body: '' });

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      const list = (d.competitions || []).filter(c => c.status !== 'draft');
      setComps(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    authFetch(`/api/competitions?id=${selectedId}`).then(r => r.json()).then(d => setComp(d.competition));
    authFetch(`/api/live-updates?competitionId=${selectedId}`).then(r => r.json()).then(d => {
      setUpdates(d.updates || []);
      setProvisional(d.provisionalResults || {});
    });
  }, [selectedId]);

  const [sendEmail, setSendEmail] = useState(true);

  const postUpdate = async () => {
    if (!newUpdate.title && !newUpdate.body) { showToast('Need a title or body', 'error'); return; }
    const res = await authFetch('/api/live-updates', {
      method: 'POST',
      body: JSON.stringify({ competitionId: selectedId, ...newUpdate, provisionalResults: provisional, sendEmail }),
    });
    if (res.ok) {
      const data = await res.json();
      setUpdates(data.dailyUpdates || []);
      setNewUpdate({ day: '', title: '', body: '' });
      if (data.emailResult?.sent) {
        showToast(`Update posted · email sent to ${data.emailResult.sent} members`);
      } else if (data.emailResult?.skipped) {
        showToast('Update posted · email API key not configured');
      } else {
        showToast('Update posted');
      }
    }
  };

  const deleteUpdate = async (updateId) => {
    if (!confirm('Delete this update?')) return;
    const res = await authFetch(`/api/live-updates?competitionId=${selectedId}&updateId=${updateId}`, { method: 'DELETE' });
    if (res.ok) {
      setUpdates(updates.filter(u => u.id !== updateId));
      showToast('Removed');
    }
  };

  const saveProvisional = async () => {
    const res = await authFetch('/api/live-updates', {
      method: 'POST',
      body: JSON.stringify({ competitionId: selectedId, provisionalResults: provisional }),
    });
    if (res.ok) showToast('Provisional standings saved');
  };

  const setPilotPlace = (pilotId, place) => {
    const p = place === '' ? '' : Number(place);
    const next = { ...provisional };
    if (p === '' || p === 0) delete next[pilotId];
    else next[pilotId] = p;
    setProvisional(next);
  };

  if (comps.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🎯</div>
        <div className="empty-title">No live competitions</div>
        <p className="small">Make a competition live in the Competitions tab first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Competition</label>
          <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {comps.map(c => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
          </select>
        </div>
      </div>

      {/* Post Update */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h2 className="h2">Post Daily Update</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
          <div className="field">
            <label>Day</label>
            <input className="input" placeholder="e.g. Day 1" value={newUpdate.day} onChange={e => setNewUpdate({ ...newUpdate, day: e.target.value })} />
          </div>
          <div className="field">
            <label>Title</label>
            <input className="input" placeholder="e.g. Perfect conditions" value={newUpdate.title} onChange={e => setNewUpdate({ ...newUpdate, title: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Body</label>
          <textarea className="input" rows={3} placeholder="24 of 31 pilots scored. Heartsill leads after the first task…"
            value={newUpdate.body} onChange={e => setNewUpdate({ ...newUpdate, body: e.target.value })}
            style={{ resize: 'vertical', minHeight: 60 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
          Email blast to all members with picks (and notification subscribers)
        </label>
        <button className="btn btn-sky" onClick={postUpdate}>Post Update</button>
      </div>

      {/* Provisional Standings */}
      {comp && comp.competitors && comp.competitors.length > 0 && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 className="h2">Provisional Standings</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--sky)', borderColor: 'var(--sky)' }}
                onClick={async () => {
                  const url = prompt(`Paste the WatchMeFly URL for current standings.\n\nExample: https://watchmefly.net/events/event.php?e=rgc2026&v=tta`);
                  if (!url) return;
                  showToast('Pulling standings from WatchMeFly…');
                  const res = await authFetch('/api/scrape-standings', {
                    method: 'POST',
                    body: JSON.stringify({ competitionId: selectedId, url }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setProvisional(data.provisionalResults || {});
                    let msg = `Matched ${data.matched.length} of ${data.standingsCount}`;
                    if (data.unmatched.length > 0) msg += ` (${data.unmatched.length} unmatched)`;
                    showToast(msg);
                  } else {
                    // Show detailed diagnostic so we can debug
                    const details = [
                      data.error || 'Scrape failed',
                      data.hint ? `\nHint: ${data.hint}` : '',
                      data.url ? `\nURL hit: ${data.url}` : '',
                      data.httpStatus !== undefined ? `\nHTTP status: ${data.httpStatus}` : '',
                      data.htmlLength !== undefined ? `\nHTML length: ${data.htmlLength} chars` : '',
                      data.pilotAnchorsFound !== undefined ? `\nPilot links found: ${data.pilotAnchorsFound}` : '',
                      data.placeCellsFound !== undefined ? `\nPlace cells found: ${data.placeCellsFound}` : '',
                      data.htmlSnippet ? `\n\nFirst 600 chars of response:\n${data.htmlSnippet}` : '',
                    ].filter(Boolean).join('');
                    alert(details);
                    showToast(data.error || 'Scrape failed', 'error');
                  }
                }}
              >Import from WatchMeFly</button>
              <button className="btn btn-sky btn-sm" onClick={saveProvisional}>Save Standings</button>
            </div>
          </div>
          <p className="small" style={{ marginBottom: 12 }}>Enter the current place for any pilot, or paste a WatchMeFly URL to auto-import.</p>
          <div className="prov-grid">
            {comp.competitors.map(p => (
              <div key={p.id} className="prov-row">
                {p.photo ? <img src={p.photo} alt="" /> : <div className="prov-photo-placeholder">?</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prov-pilot-name">{p.name}</div>
                  <div className="small">Banner #{p.number}</div>
                </div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={comp.competitors.length}
                  placeholder="–"
                  value={provisional[p.id] || ''}
                  onChange={e => setPilotPlace(p.id, e.target.value)}
                  style={{ width: 64, textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update History */}
      <div className="panel">
        <div className="panel-head"><h2 className="h2">Update History</h2></div>
        {updates.length === 0 ? (
          <p className="small">No updates posted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {updates.map(u => (
              <div key={u.id} className="update-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div>
                    {u.day && <span className="kicker" style={{ color: 'var(--electric)', marginRight: 8 }}>{u.day}</span>}
                    <strong style={{ color: 'var(--ink)' }}>{u.title}</strong>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteUpdate(u.id)}>Delete</button>
                </div>
                {u.body && <p className="small" style={{ color: 'var(--ink-soft)' }}>{u.body}</p>}
                <p className="small" style={{ color: 'var(--ink-mute)', marginTop: 4, fontSize: 11 }}>
                  Posted {new Date(u.postedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ SIMULATOR TAB ============ */
function SimulatorTab() {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [comps, setComps] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [count, setCount] = useState(10);
  const [simulatedCount, setSimulatedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authFetch('/api/competitions').then(r => r.json()).then(d => {
      const list = (d.competitions || []).filter(c => c.status !== 'draft');
      setComps(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    });
    authFetch('/api/simulator').then(r => r.json()).then(d => setSimulatedCount(d.simulatedMembers || 0));
  }, []);

  const spawn = async () => {
    if (!selectedId) { showToast('Pick a competition', 'error'); return; }
    setBusy(true);
    const res = await authFetch('/api/simulator', {
      method: 'POST',
      body: JSON.stringify({ competitionId: selectedId, count: Number(count) }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setSimulatedCount(c => c + data.count);
      showToast(`Spawned ${data.count} test members`);
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  };

  const wipe = async () => {
    if (!confirm('Wipe ALL simulated members and their bets/winnings?')) return;
    setBusy(true);
    const res = await authFetch('/api/simulator', { method: 'DELETE' });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setSimulatedCount(0);
      showToast(`Removed ${data.removed} simulated members`);
    }
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <h2 className="h2">Simulator</h2>
        </div>
        <p className="small" style={{ marginBottom: 16 }}>
          Spawn fake test members that auto-place realistic random bets. Use this to verify the leaderboard, settlement, and payout flow before real users arrive. Simulated members have IDs starting with "sim_" and can be wiped at any time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Competition</label>
            <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">— Pick a competition —</option>
              {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>How many?</label>
            <input className="input" type="number" min="1" max="20" value={count} onChange={e => setCount(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-sky" onClick={spawn} disabled={busy || !selectedId}>
            {busy ? 'Working…' : `Spawn ${count} Test Members`}
          </button>
          <button className="btn btn-ghost" onClick={wipe} disabled={busy || simulatedCount === 0}>
            Wipe All Simulated ({simulatedCount})
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2 className="h2">Currently Simulated</h2></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 56, color: 'var(--sky)' }}>{simulatedCount}</span>
          <span className="small">fake members in the system</span>
        </div>
      </div>
    </div>
  );
}
