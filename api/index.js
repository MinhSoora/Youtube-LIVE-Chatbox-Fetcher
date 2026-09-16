// Serverless function trong cùng project Vercel với React app.
// Do frontend và API cùng domain, gọi tương đối "/api?url=..." nên không cần cấu hình CORS domain nào khác.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, raw, html } = req.query;

  if (!url) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow'
    });

    const htmlContent = await response.text();

    // &raw=true -> trả về HTML thô dạng text (client tự parse)
    if (raw === 'true' || req.url.includes('raw=true')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // &html=true -> trả về HTML để trình duyệt tự render nguyên trang
    if (html === 'true' || req.url.includes('html=true')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(response.status).send(htmlContent);
    }

    // Mặc định: cố tìm sẵn videoId của livestream để trả gọn
    let streamId = null;

    const likeRegex = /"apiUrl"\s*:\s*"\/youtubei\/v1\/like\/like".*?"videoId"\s*:\s*"([\w-]{11})"/s;
    const match = htmlContent.match(likeRegex);
    if (match && match[1]) streamId = match[1];

    if (!streamId) {
      const watchMatch = htmlContent.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
      if (watchMatch && watchMatch[1]) streamId = watchMatch[1];
    }

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    if (streamId && response.status !== 301 && response.status !== 302) {
      return res.status(200).send(streamId);
    }

    return res.status(404).send('LIVE_NOT_FOUND');

  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send(`ERROR: ${error.message}`);
  }
}
