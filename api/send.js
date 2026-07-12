export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ---- Parse the raw body ourselves ----
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { text, clientInfo } = parsed;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) return res.status(500).json({ error: 'Webhook not configured' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  const payload = {
    content: `🔍 404 Visitor | IP: ${ip} | ${clientInfo}\n\`\`\`${text.slice(0, 1800)}\`\`\``
  };

  try {
    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!discordRes.ok) throw new Error(`Discord status ${discordRes.status}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message });
  }
}
