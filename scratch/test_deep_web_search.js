async function deepWebSearch(query) {
  console.log(`🔎 DEEP WEB SEARCH ENHANCEMENT TEST: "${query}"\n`);
  
  const results = [];
  const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  
  const res = await fetch(wikiUrl);
  if (res.ok) {
    const json = await res.json();
    const wikiItems = json?.query?.search || [];
    for (let i = 0; i < Math.min(wikiItems.length, 2); i++) {
      const item = wikiItems[i];
      const pageUrl = `https://id.wikipedia.org/wiki/${encodeURIComponent(item.title)}`;
      
      // DEEP SCRAPE ARTICLE BODY
      let fullBody = '';
      try {
        const pageRes = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          fullBody = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 800);
        }
      } catch (e) {}

      results.push({
        source: 'Wikipedia ID (Deep Scrape)',
        title: item.title,
        url: pageUrl,
        snippet: item.snippet.replace(/<[^>]*>/g, '').trim(),
        full_article_content: fullBody || 'Gagal ekstrak body web'
      });
    }
  }

  console.log('✅ DEEP SEARCH RESULT (Judul + Isi Web Lengkap):');
  console.log(JSON.stringify(results, null, 2));
}

deepWebSearch('iPhone 15 Pro');
