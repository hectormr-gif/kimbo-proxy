export default async function handler(req, res) {
  try {
    const { query } = req.query;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10
      })
    });

    const data = await response.json();

    const results = (data.organic || []).map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    }));

    res.status(200).json(results);

  } catch (e) {
    res.status(500).json({ error: 'search failed' });
  }
}
