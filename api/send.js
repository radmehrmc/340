export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) return res.status(500).json({ error: 'Webhook not configured' });

  const { text, clientInfo } = req.body || {};
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    const form = new FormData();
    form.append('file', new Blob([text], { type: 'text/plain' }), 'visitor_data.txt');
    form.append('payload_json', JSON.stringify({
      content: `🔍 404 Visitor | IP: ${ip} | ${clientInfo}`
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!discordRes.ok) throw new Error(`Discord error ${discordRes.status}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message });
  }
}
