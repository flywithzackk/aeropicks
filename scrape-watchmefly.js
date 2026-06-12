import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';

// Daily updates and provisional results for live multi-day events.
//
// GET ?competitionId=X — returns updates feed + provisional standings
// POST — admin posts a new daily update
//   body: { competitionId, title, body, day, provisionalResults: { pilotId: place } }
// DELETE ?competitionId=X&updateId=Y — admin removes an update

// Email blast helper. Requires RESEND_API_KEY env var (or it silently no-ops).
async function sendEmailBlast(competition, update) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, skipped: 'no API key' };

  const profilesStore = stores.profiles();
  const betsStore = stores.bets();

  // Recipients = users with picks OR subscribed to notifications for this comp
  const { blobs } = await profilesStore.list();
  const recipients = [];
  for (const b of blobs) {
    const p = await profilesStore.get(b.key, { type: 'json' });
    if (!p?.email || p.simulated) continue;
    const userBets = await betsStore.get(b.key, { type: 'json' });
    const hasPicks = userBets && userBets[competition.id];
    const isSubbed = (p.notifySubscriptions || []).includes(competition.id);
    if (hasPicks || isSubbed) {
      recipients.push({ email: p.email, username: p.username });
    }
  }

  if (recipients.length === 0) return { sent: 0 };

  const subject = `${competition.name} — ${update.day ? update.day + ' · ' : ''}${update.title || 'New Update'}`;
  const htmlBody = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0b0e;color:#f5f5f7;padding:32px 16px;margin:0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
      <tr><td style="padding-bottom:24px;text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;letter-spacing:.06em;font-size:32px;color:#5EB3E4;">AEROPICKS</div>
      </td></tr>
      <tr><td>
        <div style="background:#16181d;border:1.5px solid #2a2d35;border-radius:14px;padding:24px;">
          <div style="font-size:11px;letter-spacing:.08em;color:#7CD992;text-transform:uppercase;font-weight:700;margin-bottom:8px;">
            ${update.day ? update.day + ' · ' : ''}${competition.name}
          </div>
          <h1 style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:.02em;margin:0 0 16px;">${update.title || 'New Update'}</h1>
          ${update.body ? `<p style="line-height:1.55;color:#c9ccd1;margin:0 0 18px;">${update.body.replace(/\n/g, '<br>')}</p>` : ''}
          <a href="https://aeropicks.com/competition/${competition.id}" style="display:inline-block;background:#5EB3E4;color:#0a0b0e;text-decoration:none;padding:11px 22px;border-radius:99px;font-weight:700;">View on Aeropicks →</a>
        </div>
      </td></tr>
      <tr><td style="padding-top:18px;text-align:center;color:#6e727a;font-size:12px;">
        You're receiving this because you have picks or subscribed to updates for this competition.
      </td></tr>
    </table>
  </body></html>`;

  // Send via Resend in batches of 50
  let sent = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Aeropicks <updates@aeropicks.com>',
          to: batch.map(b => b.email),
          subject,
          html: htmlBody,
        }),
      });
      if (r.ok) sent += batch.length;
    } catch (ex) {
      // Continue with next batch
    }
  }

  return { sent, totalRecipients: recipients.length };
}

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const compStore = stores.competitions();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const competitionId = url.searchParams.get('competitionId');
    if (!competitionId) return json({ updates: [], provisionalResults: {} });
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ updates: [], provisionalResults: {} });

    // Sort updates newest first
    const updates = (comp.dailyUpdates || []).slice().sort((a, b) => b.postedAt - a.postedAt);
    return json({
      updates,
      provisionalResults: comp.provisionalResults || {},
    });
  }

  if (req.method === 'POST') {
    if (!user.isAdmin) return forbidden();
    const body = await req.json();
    const { competitionId, title, body: noteBody, day, provisionalResults, sendEmail } = body;
    if (!competitionId) return json({ error: 'competitionId required' }, 400);
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);

    if (!comp.dailyUpdates) comp.dailyUpdates = [];

    let createdUpdate = null;
    // If they provided a title/body, this is a new update
    if (title || noteBody) {
      createdUpdate = {
        id: uid(),
        day: day || null,
        title: title || '',
        body: noteBody || '',
        postedAt: Date.now(),
        postedBy: user.id,
      };
      comp.dailyUpdates.unshift(createdUpdate);
    }

    // If they provided provisional results, merge them
    if (provisionalResults && typeof provisionalResults === 'object') {
      comp.provisionalResults = { ...(comp.provisionalResults || {}), ...provisionalResults };
    }

    comp.updatedAt = Date.now();
    await compStore.setJSON(competitionId, comp);

    // Email blast if admin asked AND this is a new update with content
    let emailResult = null;
    if (sendEmail && createdUpdate) {
      try {
        emailResult = await sendEmailBlast(comp, createdUpdate);
      } catch (ex) {
        emailResult = { error: ex.message };
      }
    }

    return json({
      ok: true,
      dailyUpdates: comp.dailyUpdates,
      provisionalResults: comp.provisionalResults,
      emailResult,
    });
  }

  if (req.method === 'DELETE') {
    if (!user.isAdmin) return forbidden();
    const competitionId = url.searchParams.get('competitionId');
    const updateId = url.searchParams.get('updateId');
    if (!competitionId || !updateId) return json({ error: 'ids required' }, 400);
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    comp.dailyUpdates = (comp.dailyUpdates || []).filter(u => u.id !== updateId);
    comp.updatedAt = Date.now();
    await compStore.setJSON(competitionId, comp);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};

