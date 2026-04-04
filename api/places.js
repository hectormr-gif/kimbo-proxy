// api/places.js — Buscar agencias inmobiliarias via Google Places API (New)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ZONA_COORDS = {
  'Costa del Sol (completa)':    { lat: 36.5101, lng: -4.8826, radius: 50000 },
  'Marbella':                    { lat: 36.5101, lng: -4.8826, radius: 15000 },
  'Estepona':                    { lat: 36.4269, lng: -5.1469, radius: 12000 },
  'Mijas Costa':                 { lat: 36.5007, lng: -4.6385, radius: 12000 },
  'Benalmádena':                 { lat: 36.5988, lng: -4.5175, radius: 8000  },
  'Fuengirola':                  { lat: 36.5407, lng: -4.6253, radius: 8000  },
  'Torremolinos':                { lat: 36.6210, lng: -4.4997, radius: 8000  },
  'Manilva':                     { lat: 36.3736, lng: -5.2385, radius: 8000  },
  'Casares':                     { lat: 36.4378, lng: -5.2674, radius: 8000  },
  'Benahavís':                   { lat: 36.5256, lng: -5.0395, radius: 10000 },
  'Málaga capital':              { lat: 36.7213, lng: -4.4214, radius: 12000 },
  'Nerja y Axarquía':            { lat: 36.7468, lng: -3.8721, radius: 20000 },
  'Alhaurín y área metropolitana': { lat: 36.6446, lng: -4.6963, radius: 20000 },
  'Ronda':                       { lat: 36.7462, lng: -5.1619, radius: 10000 },
  'Sevilla capital':             { lat: 37.3891, lng: -5.9845, radius: 12000 },
  'Sevilla área metropolitana':  { lat: 37.3891, lng: -5.9845, radius: 30000 },
  'Granada capital':             { lat: 37.1773, lng: -3.5986, radius: 12000 },
  'Córdoba capital':             { lat: 37.8882, lng: -4.7794, radius: 12000 },
  'Cádiz y Jerez':               { lat: 36.5271, lng: -6.2886, radius: 30000 },
  'Almería capital':             { lat: 36.8340, lng: -2.4637, radius: 12000 },
  'Huelva capital':              { lat: 37.2614, lng: -6.9447, radius: 12000 },
  'Jaén capital':                { lat: 37.7796, lng: -3.7849, radius: 12000 },
  'Madrid capital':              { lat: 40.4168, lng: -3.7038, radius: 15000 },
  'Madrid norte':                { lat: 40.5600, lng: -3.6800, radius: 20000 },
  'Madrid oeste (Pozuelo, Las Rozas, Majadahonda)': { lat: 40.4360, lng: -3.8780, radius: 15000 },
  'Madrid sur':                  { lat: 40.3500, lng: -3.7000, radius: 20000 },
  'Madrid este':                 { lat: 40.4500, lng: -3.6000, radius: 20000 },
  'Barcelona y área metropolitana': { lat: 41.3851, lng: 2.1734, radius: 20000 },
  'Valencia capital':            { lat: 39.4699, lng: -0.3763, radius: 12000 },
  'Mallorca':                    { lat: 39.6953, lng: 2.9136, radius: 40000 },
  'Ibiza':                       { lat: 38.9067, lng: 1.4206, radius: 20000 },
};

async function searchPlaces(query, coords, apiKey) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'es',
      locationBias: {
        circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: coords.radius }
      },
      maxResultCount: 20,
    }),
  });
  const data = await r.json();
  return data.places || [];
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { zona } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
  if (!zona)   return res.status(400).json({ error: 'zona required' });

  const coords = ZONA_COORDS[zona];
  if (!coords) return res.status(400).json({ error: `Zona "${zona}" not found` });

  try {
    const queries = [
      `inmobiliaria ${zona}`,
      `agencia inmobiliaria lujo ${zona}`,
      `real estate ${zona}`,
      `luxury homes ${zona}`,
      `propiedades lujo ${zona}`,
      `estate agents ${zona}`,
      `agentes inmobiliarios ${zona}`,
    ];

    const allPlaces = new Map();
    const results = await Promise.allSettled(queries.map(q => searchPlaces(q, coords, apiKey)));
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        r.value.forEach(p => { if (!allPlaces.has(p.id)) allPlaces.set(p.id, p); });
      }
    });

    const realEstateKeywords = ['inmobiliaria','real estate','homes','properties','realty','property','estates','agency','agencia','propiedades','viviendas'];
    const realEstateTypes = ['real_estate_agency','real_estate_agent'];

    const places = Array.from(allPlaces.values())
      .filter(p => {
        if (p.businessStatus === 'CLOSED_PERMANENTLY') return false;
        const name = (p.displayName?.text || '').toLowerCase();
        return (p.types || []).some(t => realEstateTypes.includes(t)) ||
               realEstateKeywords.some(k => name.includes(k));
      })
      .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0))
      .map(p => ({
        google_id:   p.id,
        nombre:      p.displayName?.text || '',
        direccion:   p.formattedAddress || '',
        telefono:    p.internationalPhoneNumber || '',
        web:         p.websiteUri || '',
        rating:      p.rating || null,
        num_resenas: p.userRatingCount || 0,
        tipos:       p.types || [],
        zona:        zona,
      }));

    return res.status(200).json({ places, total: places.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
