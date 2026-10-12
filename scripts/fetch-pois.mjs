import fs from 'node:fs/promises';
import { lodgingWebsite } from '../lib/tmb/poi-websites.js';
const box = '45.66,6.60,46.12,7.23';
const query = `[out:json][timeout:30];(nwr["tourism"="alpine_hut"](${box});nwr["tourism"="hotel"](${box});node["natural"="saddle"](${box});node["natural"="peak"](${box});node["place"~"village|hamlet"](${box});node["tourism"="viewpoint"](${box}););out center meta;`;
const r = await fetch('https://overpass.private.coffee/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'TMB-Atelier/1.0 (https://tmb-atelier.poorygon.chatgpt.site)' },
  body: new URLSearchParams({ data: query }),
  signal: AbortSignal.timeout(45000),
});
if (!r.ok) throw Error(`OSM POI HTTP ${r.status}`);
const data = await r.json();
if (data.remark || !data.elements?.length) throw Error(data.remark || 'Empty OSM excerpt');
const points = data.elements.filter(e => e.tags?.name).map(e => {
  const tags = e.tags;
  const type = tags.tourism === 'alpine_hut' ? 'refuge' : tags.tourism === 'hotel' ? 'hotel' : tags.natural === 'saddle' ? 'col' : tags.natural === 'peak' ? 'sommet' : tags.place ? 'village' : 'poi';
  return {
    id: `${e.type}/${e.id}`,
    name: tags.name,
    lat: e.lat ?? e.center.lat,
    lon: e.lon ?? e.center.lon,
    ele: Number.isFinite(+tags.ele) ? +tags.ele : undefined,
    type,
    version: e.version,
    url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    website: lodgingWebsite(type, tags),
  };
});
await fs.writeFile('public/data/pois.json', JSON.stringify({
  extractedAt: new Date().toISOString(),
  license: '© OpenStreetMap contributors · ODbL 1.0',
  query,
  points,
}));
console.log({ points: points.length });

