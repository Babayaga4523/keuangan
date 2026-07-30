async function testLiveWebSearch(query) {
  console.log(`🔎 PENGUJIAN KONEKSI LIVE INTERNET SEARCH untuk query: "${query}"\n`);
  
  const searchUrls = [
    {
      name: 'Google News RSS Indonesia',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`
    },
    {
      name: 'Yahoo News RSS',
      url: `https://news.search.yahoo.com/rss?p=${encodeURIComponent(query)}`
    },
    {
      name: 'Wikipedia Indonesia API',
      url: `https://id.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(query)}`
    }
  ];

  for (const engine of searchUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(engine.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        console.log(`✅ [${engine.name}] BERHASIL AMBIL DATA LIVE! (Ukuran respon: ${text.length} bytes)`);
        
        // Extract title tags from RSS
        const titleMatches = text.match(/<title>(.*?)<\/title>/gi) || [];
        const snippets = titleMatches.slice(1, 4).map(t => t.replace(/<\/?title>/g, '').trim());
        if (snippets.length > 0) {
          console.log('   Hasil Judul Berita Terkini Live:');
          snippets.forEach((s, idx) => console.log(`   ${idx + 1}. ${s}`));
        }
      } else {
        console.log(`⚠️ [${engine.name}] Status ${res.status}`);
      }
    } catch (err) {
      console.log(`❌ [${engine.name}] Error: ${err.message}`);
    }
    console.log('');
  }
}

testLiveWebSearch('iPhone 15 Pro Indonesia harga hari ini');
