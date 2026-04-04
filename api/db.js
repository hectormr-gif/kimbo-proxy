// api/db.js — Kimbo Prospector shared database
// Upstash Redis via REST API (env vars injected by Vercel)

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const ALLOWED_KEYS = [
  'promociones',
  'mercado',
  'zona_history',
  'zona_history_mercado',
  'search_log',
  'team',
  'custom_sources',
];

const DEFAULTS = {
  promociones:          [],
  mercado:              [],
  zona_history:         {},
  zona_history_mercado: {},
  search_log:           [],
  team:                 ['Ferni', 'Malu', 'Gonzalo', 'Héctor'],
  custom_sources:       {},
};

async function redis(cmd, ...args) {
  const body = JSON.stringify([cmd, ...args]);
  const res  = await fetch(`${REDIS_URL}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const json = await res.json();
  return json.result;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key } = req.query;

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  // ── GET — leer valor ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const raw = await redis('GET', `kimbo:${key}`);
      if (raw === null) {
        return res.status(200).json(DEFAULTS[key]);
      }
      return res.status(200).json(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PUT — guardar valor completo ──────────────────────────────
  if (req.method === 'PUT') {
    try {
      const data = req.body;
      await redis('SET', `kimbo:${key}`, JSON.stringify(data));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
