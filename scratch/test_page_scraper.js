async function scrapeArticleText(url) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(id);

    if (res.ok) {
      const html = await res.text();
      // Extract <p> tags text
      const pMatches = html.match(/<p[\s\S]*?>([\s\S]*?)<\/p>/gi) || [];
      const paragraphs = pMatches
        .map(p => p.replace(/<[^>]*>/g, '').trim())
        .filter(text => text.length > 40 && !text.toLowerCase().includes('cookie') && !text.toLowerCase().includes('copyright'));

      const pageText = paragraphs.slice(0, 5).join('\n\n');
      console.log('✅ BERHASIL AMBIL ISI BADAN WEB (Full Body Paragraphs):');
      console.log('----------------------------------------------------');
      console.log(pageText.substring(0, 600) + '...\n');
      return pageText;
    }
  } catch (err) {
    console.log('Scrape error:', err.message);
  }
  return null;
}

scrapeArticleText('https://id.wikipedia.org/wiki/IPhone_15');
