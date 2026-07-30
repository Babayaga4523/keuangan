async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function testRssEngines(query) {
  console.log(`\n=== Testing Multi-Engine Search for "${query}" ===`);
  const results = [];

  // Engine 1: Google News RSS
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
    const res = await fetchWithTimeout(rssUrl, {}, 3000);
    if (res.ok) {
      const xml = await res.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (let i = 0; i < Math.min(itemMatches.length, 5); i++) {
        const item = itemMatches[i];
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
        const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
        if (titleMatch) {
          const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          results.push({
            source: 'Berita & Pasar (Google)',
            title: cleanTitle,
            snippet: pubDateMatch ? `Info: ${pubDateMatch[1]}` : cleanTitle,
            url: linkMatch ? linkMatch[1] : ''
          });
        }
      }
    }
  } catch (e) {
    console.log('[Google News Error]:', e.message);
  }

  // Engine 2: Yahoo Search RSS
  try {
    const yahooUrl = `https://news.search.yahoo.com/rss?p=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(yahooUrl, {}, 3000);
    if (res.ok) {
      const xml = await res.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (let i = 0; i < Math.min(itemMatches.length, 3); i++) {
        const item = itemMatches[i];
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
        const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
        if (titleMatch) {
          const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim();
          const cleanDesc = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim() : '';
          results.push({
            source: 'Yahoo Web Search',
            title: cleanTitle,
            snippet: cleanDesc || cleanTitle
          });
        }
      }
    }
  } catch (e) {
    console.log('[Yahoo Error]:', e.message);
  }

  // Engine 3: Wikipedia ID
  try {
    const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const res = await fetchWithTimeout(wikiUrl, {}, 3000);
    if (res.ok) {
      const json = await res.json();
      const wikiItems = json?.query?.search || [];
      for (let i = 0; i < Math.min(wikiItems.length, 3); i++) {
        const item = wikiItems[i];
        const cleanSnippet = item.snippet.replace(/<[^>]*>/g, '').trim();
        results.push({
          source: 'Wikipedia Indonesia',
          title: item.title,
          snippet: cleanSnippet,
          url: `https://id.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
        });
      }
    }
  } catch (e) {
    console.log('[Wiki Error]:', e.message);
  }

  console.log('Results:', JSON.stringify(results, null, 2));
}

testRssEngines('harga pasar iPhone 15 Pro hari ini Indonesia');
