// api/send.js

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Read the secret webhook URL from Vercel environment variables
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
  if (!DISCORD_WEBHOOK_URL) {
    return new Response(JSON.stringify({ error: 'Webhook not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get client IP (Vercel sets x-forwarded-for)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // ----- Simple in‑memory rate limiter (1 hour) -----
  // Resets on cold start – use Vercel KV for persistence across deployments
  const RATE_LIMIT_MS = 60 * 60 * 1000;   // 1 hour
  if (!global.rateLimitMap) global.rateLimitMap = new Map();
  const now = Date.now();
  if (global.rateLimitMap.has(ip) && now - global.rateLimitMap.get(ip) < RATE_LIMIT_MS) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse incoming data
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { text, clientInfo } = body;

  // Build Discord message with file attachment
  const formData = new FormData();
  formData.append('file', new Blob([text], { type: 'text/plain' }), 'visitor_data.txt');
  formData.append('payload_json', JSON.stringify({
    content: `🔍 404 Visitor | IP: ${ip} | ${clientInfo}`,
  }));

  try {
    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    if (!discordRes.ok) throw new Error(`Discord responded with ${discordRes.status}`);

    // Update rate limit
    global.rateLimitMap.set(ip, now);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Failed to send to Discord' }), { status: 502 });
  }
}
