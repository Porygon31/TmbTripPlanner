import fs from 'node:fs/promises';
const ids=[9678362,9678267,9678296,9678375,9678380,9678437];
await fs.mkdir('public/data/sources',{recursive:true});
for(const id of ids){
 for(const [name,url] of [['ways',`https://hiking.waymarkedtrails.org/api/v1/details/relation/${id}`],['metadata',`https://api.openstreetmap.org/api/0.6/relation/${id}.json`]]){
  const path=`public/data/sources/${id}-${name}.json`;try{await fs.access(path);continue;}catch{}
  const r=await fetch(url,{headers:{'User-Agent':'TMB-Atelier/1.0 (OSM catalogue extraction)'},signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error(`${id} ${name} HTTP ${r.status}`);const data=await r.json();await fs.writeFile(path,JSON.stringify(data));console.log(`${id} ${name} saved`);
 }
}
