// Cloudflare Worker: Papillon Leaderboard Backend
// Layers of protection:
//   1. Browser detection ( reject curl / scripts )
//   2. Rate limiting ( max 5/min per IP )
//   3. Input validation ( time 15-600s, faults 0-50 )
//   4. Turnstile verification ( human / bot check )
//   5. Rank calculation on server side

const RATE_LIMIT = 5; // max submissions per IP per minute
const RATE_WINDOW_MS = 60_000;
const rateLimiter = new Map(); // ip -> { count, resetAt }

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimiter.get(ip);
  if (!record) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_WINDOW_MS;
    return false;
  }
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  record.count++;
  return false;
}

function isBrowserRequest(request) {
  // Modern browsers send Sec-Fetch-* headers
  return request.headers.get('Sec-Fetch-Dest') !== null ||
         request.headers.get('Sec-Fetch-Mode') !== null;
}

async function verifyTurnstile(token, secretKey) {
  if (!secretKey) return true; // bypass if not configured
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
  });
  const data = await resp.json();
  return data.success === true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const requestOrigin = request.headers.get('Origin') || '';
    const productionOrigin = env.ALLOWED_ORIGIN || 'https://kasia-kujawa.github.io';
    const isLocalhost = requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('https://localhost:');
    const isAllowed = isLocalhost || requestOrigin === productionOrigin;

    if (!isAllowed) {
      return new Response('Origin not allowed', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── GET /leaderboard ───────────────────────────────────────────────────────
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const safeLimit = Math.min(Math.max(limit, 1), 50);

        const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/leaderboard?select=*&order=faults.asc&order=time.asc&limit=${safeLimit}`;
        const resp = await fetch(supabaseUrl, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        });

        if (!resp.ok) throw new Error('Supabase fetch failed');
        const data = await resp.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
        return new Response(JSON.stringify({ error: 'Could not load leaderboard' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── POST /submit-score ─────────────────────────────────────────────────────
    if (url.pathname === '/submit-score' && request.method === 'POST') {
      // ── Layer 2: Browser detection ──────────────────────
      if (!isBrowserRequest(request)) {
        return new Response(JSON.stringify({ ok: false, error: 'Browser required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

      // ── Layer 1: Rate limiting ──────────────────────────
      if (isRateLimited(clientIP)) {
        return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body = await request.json();
        const { player_name, time, faults, token } = body;

        // Validate name
        const name = (player_name || 'Anonymous').trim().substring(0, 50);

        // ── Layer 3: Turnstile verification ─────────────────
        const hasTurnstile = env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SECRET_KEY.length > 0;
        const isLocalhost = requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('https://localhost:');
        if (hasTurnstile && !isLocalhost) {
          if (!token) {
            return new Response(JSON.stringify({ ok: false, error: 'Turnstile token missing' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          const turnstileOk = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
          if (!turnstileOk) {
            return new Response(JSON.stringify({ ok: false, error: 'Turnstile verification failed' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // ── Layer 3b: Input validation ──────────────────────
        if (typeof time !== 'number' || !isFinite(time) || time < 15 || time > 600) {
          return new Response(JSON.stringify({ ok: false, error: 'Invalid time' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (typeof faults !== 'number' || !Number.isInteger(faults) || faults < 0 || faults > 50) {
          return new Response(JSON.stringify({ ok: false, error: 'Invalid faults' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Insert via publishable key (RLS insert policy allows this)
        const insertResp = await fetch(`${env.SUPABASE_URL}/rest/v1/leaderboard`, {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({ player_name: name, time, faults }),
        });

        if (!insertResp.ok) {
          const errText = await insertResp.text();
          console.error('Insert failed:', errText);
          return new Response(JSON.stringify({ ok: false, error: 'Insert failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const inserted = await insertResp.json();

        // Calculate rank: count entries that are strictly better
        // (fewer faults) OR (same faults but faster time)
        const countUrl = `${env.SUPABASE_URL}/rest/v1/leaderboard?select=id&or=(faults.lt.${faults},and(faults.eq.${faults},time.lt.${time}))&head=true&count=exact`;
        const countResp = await fetch(countUrl, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        });

        let rank = null;
        if (countResp.ok) {
          const contentRange = countResp.headers.get('Content-Range'); // "0-0/123"
          const match = contentRange?.match(/\/(\d+)$/);
          rank = match ? parseInt(match[1], 10) + 1 : null;
        }

        return new Response(JSON.stringify({ ok: true, rank }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Submit error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
