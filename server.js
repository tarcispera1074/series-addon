import http from "node:http";
import { URL } from "node:url";

// =========================================================================
// 📌 1. CONSTANTS (DO NOT TOUCH THIS SECTION)
// =========================================================================
const PORT = Number(process.env.PORT || 7000);

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

// =========================================================================
// ✏️ 2. CONFIGURATION (EDIT THIS SECTION FOR YOUR TARGET WEBSITE)
// =========================================================================

// /* TODO: EDIT 2A - Set your target website URL */
const TARGET_SITE = "https://pornx11.com"; 

// /* TODO: EDIT 2B - Set your addon Manifest (Name, ID, Logo) */
const manifest = {
  id: "com.pornx11.addon",              // Unique ID (e.g. com.myname.mysite)
  version: "1.0.0",
  name: "Pornx 11",                       // Addon name shown in Nuvio
  description: "Streams movies from target site",
  logo: "https://pornx11.com/wp-content/uploads/2023/10/Ponx11-Logo.png",    // Addon icon URL
    resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  idPrefixes: ["custom:"],
  catalogs: [
    {
      type: "movie",
      id: "pornx11_catalog",
      name: "Pornx11 Watches",                      // Catalog tab name shown in Nuvio
      extra: [{ name: "search", isRequired: false }]
    }
  ]
};

// =========================================================================
// ✏️ 3. CATALOG & SEARCH SCRAPER (EDIT THIS FOR YOUR WEBSITE'S HTML)
// =========================================================================
async function fetchCatalog(searchQuery = "") {
  // /* TODO: EDIT 3A - Set your site's catalog and search URL format */
  const targetUrl = searchQuery
    ? `https://pornx11.com/?s=${encodeURIComponent(searchQuery)}`
    : `https://pornx11.com`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" 
      }
    });
    const html = await response.text();
    const metas = [];

    // /* TODO: EDIT 3B - Set Regex patterns to match your site's href links & posters */
    const linkMatches = [...html.matchAll(/href=["'](https:\/\/pornx11\.com\/[^"']+)["']/g)];
    const titleMatches = [...html.matchAll(/title=["']([^"']+)["']/g)];
    const imgMatches = [...html.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["']/g)];

    const seen = new Set();
    for (let i = 0; i < linkMatches.length; i++) {
      const slug = linkMatches[i][1];
      if (seen.has(slug)) continue;
      seen.add(slug);

            // Extract title and remove "| Watch Now" or "| Watch Free"
      const rawTitle = titleMatches[i] ? titleMatches[i][1] : slug;
      const cleanTitle = rawTitle.replace(/\s*\|\s*Watch\s*(Now|Free)/i, "").trim();

      metas.push({
        id: `custom:${encodeURIComponent(slug)}`,
        name: cleanTitle,
        type: "movie",
        poster: imgMatches[i] ? imgMatches[i][1] : ""
      });
    }
    return metas;
  } catch (err) {
    console.error("Scraper Error:", err);
    return [];
  }
}

// =========================================================================
// ⚡ 4. REAL-DEBRID & VIDEO STREAM RESOLVER
// =========================================================================
const RD_API_KEY = process.env.RD_API_KEY || "QUGDHX5IF74Z6JEXBICECQ5YK6E3NS7M4NYPTAALSHK3B6LGVZOA";

async function unrestrictWithRealDebrid(hosterUrl) {
  if (!hosterUrl || !RD_API_KEY) {
    return hosterUrl;
  }

  try {
    const res = await fetch("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RD_API_KEY}` },
      body: new URLSearchParams({ link: hosterUrl })
    });
    const data = await res.json();
    return data.download || hosterUrl;
  } catch (err) {
    console.error("Real-Debrid Error:", err);
    return hosterUrl;
  }
}

async function fetchStream(movieUrl) {
  try {
    // 1. Clean and fully decode URL
    let cleanUrl = decodeURIComponent(movieUrl).replace(/^custom:/, "");
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = decodeURIComponent(cleanUrl);
    }

    // 2. Fetch the movie page HTML
    const res = await fetch(cleanUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();

    // 3. Search for video sources across all formats (m3u8, mp4, iframe data-src, source tags, player configs)
    const streamPatterns = [
      /https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)/i,
      /<iframe[^>]+(?:src|data-src)=["'](https?:\/\/[^"']+)["']/i,
      /<source[^>]+src=["'](https?:\/\/[^"']+)["']/i,
      /(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+)["']/i
    ];

    let rawVideoUrl = "";
    for (const pattern of streamPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawVideoUrl = match[1] || match[0];
        break;
      }
    }

    // Fallback: If no direct embed pattern matches, use page URL
    if (!rawVideoUrl) {
      rawVideoUrl = cleanUrl;
    }

    // 4. Unrestrict link through Real-Debrid
    const fastStreamUrl = await unrestrictWithRealDebrid(rawVideoUrl);

    return [
      {
        title: "⚡ Real-Debrid Fast Stream (1080p)",
        url: fastStreamUrl
      },
      {
        title: "🌐 Direct Source Stream",
        url: rawVideoUrl
      }
    ];
  } catch (err) {
    console.error("Stream extraction error:", err);
    return [];
  }
}

// =========================================================================
// 📌 5. SERVER ROUTING (DO NOT TOUCH THIS SECTION)
// =========================================================================
http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = requestUrl.pathname;

  // Manifest
  if (path === "/manifest.json") return sendJson(res, 200, manifest);

  // Catalog / Search Handler
  if (path.startsWith("/catalog/")) {
    const match = path.match(/\/catalog\/movie\/movies_catalog(?:\/(.+))?\.json$/);
    let query = "";
    if (match && match[1]) {
      for (const p of match[1].split("&")) {
        if (p.startsWith("search=")) query = decodeURIComponent(p.split("=")[1]);
      }
    }
    const metas = await fetchCatalog(query);
    return sendJson(res, 200, { metas });
  }

    // Meta Handler (Opens the movie details screen in Nuvio)
  if (path.startsWith("/meta/")) {
    const match = path.match(/\/meta\/movie\/(.+)\.json$/);
    const id = match ? decodeURIComponent(match[1]) : "";
    const rawName = id.replace(/^custom:/, "").replace(/https?:\/\/[^\/]+\//, "").replace(/\/$/, "").replace(/-/g, " ");
    const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    return sendJson(res, 200, {
      meta: {
        id: id,
        type: "movie",
        name: cleanName,
        description: "Ready to stream via Real-Debrid"
      }
    });
  }

  // Stream Handler
  if (path.startsWith("/stream/")) {
    const match = path.match(/\/stream\/movie\/(.+)\.json$/);
    const slug = match ? decodeURIComponent(match[1]) : "";
    const streams = await fetchStream(slug);
    return sendJson(res, 200, { streams });
  }

  return sendJson(res, 404, { error: "Not found" });
}).listen(PORT, () => {
  console.log(`Addon server running on port ${PORT}`);
});
