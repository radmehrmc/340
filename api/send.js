// api/send.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Read the secret webhook from Vercel environment variables
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) {
    return res.status(500).json({ error: 'Webhook not configured on server' });
  }

  // Client IP from Vercel headers
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  // In‑memory rate limiter (1 hour)
  const RATE_LIMIT_MS = 60 * 60 * 1000;
  if (!global.rateLimitMap) global.rateLimitMap = new Map();
  const now = Date.now();
  if (global.rateLimitMap.has(ip) && now - global.rateLimitMap.get(ip) < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Rate limited' });
  }

  // Parse the JSON body
  const { text, clientInfo } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: 'Missing text content' });
  }

  // Build Discord message with file attachment
  const FormData = (await import('formdata-node')).FormData; // Node.js 18+ has native FormData
  // If you're using Node 18+, you can just use `new FormData()`

  const form = new FormData();
  form.append('file', new Blob([text], { type: 'text/plain' }), 'visitor_data.txt');
  form.append('payload_json', JSON.stringify({
    content: `🔍 404 Visitor | IP: ${ip} | ${clientInfo}`,
  }));

  try {
    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      body: form,
    });

    if (!discordRes.ok) throw new Error(`Discord error ${discordRes.status}`);

    global.rateLimitMap.set(ip, now);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Failed to send to Discord' });
  }
}
