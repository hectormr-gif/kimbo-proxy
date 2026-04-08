// api/db.js — Kimbo Prospector shared database
// Upstash Redis via REST API (env vars injected by Vercel)
const REDIS_URL   = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

const ALLOWED_KEYS = [
  'promociones',
  'mercado',
  'agencias',
  'partners',
  'zona_history',
  'zona_history_mercado',
  'zona_history_partners',
  'search_log',
  'session_log',
  'team',
  'custom_sources',
  'tokens',
  'last_billing_error',
];

const DEFAULTS = {
  promociones:           [],
  mercado:               [],
  agencias:              [],
  partners:              [],
  zona_history:          {},
  zona_history_mercado:  {},
  zona_history_partners: {},
  search_log:            [],
  session_log:           [],
  team:                  ['Ferni', 'Malu', 'Gonzalo', 'Héctor'],
  custom_sources:        {},
  tokens:                { input: 0, output: 0, calls: 0, historial: [] },
  last_billing_error:    null,
};

async function redis(cmd, ...args) {
  const res = await fetch(`${REDIS_URL}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([cmd, ...args]),
  });
  const json = await res.json();
  return json.result;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400',
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { key } = req.query;
  if (!key || !ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  // GET — leer valor
  if (req.method === 'GET') {
    try {
      const raw = await redis('GET', `kimbo:${key}`);
      if (raw === null) return res.status(200).json(DEFAULTS[key] ?? []);
      return res.status(200).json(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT — guardar valor completo
  if (req.method === 'PUT') {
    try {
      await redis('SET', `kimbo:${key}`, JSON.stringify(req.body));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
