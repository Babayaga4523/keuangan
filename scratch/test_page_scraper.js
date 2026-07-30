async function fetchPageContent(url) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const html = await res.text();
    // Extract paragraph text or main text
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleanText.substring(0, 1000);
  } catch (err) {
    return null;
  }
}

async function testFullWebPageReading() {
  console.log('🔎 TESTING FULL WEBPAGE BODY CONTENT SCRAPING:\n');
  const testUrl = 'https://id.wikipedia.org/wiki/iPhone_15_Pro';
  console.log(`Mengunduh isi halaman web lengkap dari: ${testUrl}...`);

  const pageBody = await fetchPageContent(testUrl);
  if (pageBody) {
    console.log('✅ BERHASIL MEMBACA ISI PENUH WEB! (Snippet 300 Karakter Pertama):');
    console.log('--------------------------------------------------');
    console.log(pageBody.substring(0, 300) + '...');
    console.log('--------------------------------------------------');
  } else {
    console.log('❌ Gagal mengunduh isi halaman web.');
  }
}

testFullWebPageReading();
