// Optional CORS proxy for NASA POWER (Cloudflare Worker). NOT required:
// POWER already sends `access-control-allow-origin: *` (docs/DATA_NOTES.md §1).
// Deploy with `npx wrangler deploy proxy/worker.js`, then build the app with
// VITE_POWER_PROXY=https://<your-worker>.workers.dev
const UPSTREAM = 'https://power.larc.nasa.gov';
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/temporal/monthly/')) return new Response('Not found', { status: 404 });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, { cf: { cacheTtl: 86400, cacheEverything: true } });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors())) res.headers.set(k, v);
    return res;
  },
};
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' });
