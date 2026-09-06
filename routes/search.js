const express = require('express');
const router = express.Router();

// Uses Node 18+ global fetch. No node-fetch dependency needed.

// GET /api/search?q=... - search Wikipedia + DuckDuckGo Instant Answer
// Returns candidate organisations to add to the CRM.
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });

  try {
    const [wiki, ddg] = await Promise.allSettled([
      wikipediaSearch(q),
      duckDuckGoSearch(q)
    ]);

    const results = [];
    if (wiki.status === 'fulfilled') results.push(...wiki.value);
    if (ddg.status === 'fulfilled') results.push(...ddg.value);

    // dedupe by title
    const seen = new Set();
    const deduped = results.filter(r => {
      const key = r.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ results: deduped.slice(0, 15) });
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function wikipediaSearch(q) {
  const langs = ['en', 'pt'];
  const out = [];
  for (const lang of langs) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&format=json&limit=5&search=${encodeURIComponent(q)}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'LWP-CRM/1.0' } });
      if (!resp.ok) continue;
      const data = await resp.json();
      // opensearch returns [query, titles, descriptions, urls]
      const [, titles = [], descs = [], urls = []] = data;
      titles.forEach((title, i) => {
        out.push({
          source: `wikipedia.${lang}`,
          title,
          description: (descs[i] || '').slice(0, 240),
          url: urls[i] || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        });
      });
    } catch (_) { /* continue */ }
  }
  return out;
}

async function duckDuckGoSearch(q) {
  // DuckDuckGo Instant Answer API — free, no key. Best for well-known entities.
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'LWP-CRM/1.0' } });
    if (!resp.ok) return [];
    const data = await resp.json();
    const out = [];
    if (data.Heading && data.AbstractText) {
      out.push({
        source: 'duckduckgo',
        title: data.Heading,
        description: (data.AbstractText || '').slice(0, 240),
        url: data.AbstractURL || data.FirstURL || '',
      });
    }
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 4).forEach(t => {
        if (t.Text && t.FirstURL) {
          const title = t.Text.split(' - ')[0].slice(0, 120);
          out.push({
            source: 'duckduckgo',
            title,
            description: t.Text.slice(0, 240),
            url: t.FirstURL,
          });
        }
      });
    }
    return out;
  } catch (_) {
    return [];
  }
}

module.exports = router;
