import fs from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
const doc=new DOMParser().parseFromString(fs.readFileSync('public/data/sources/9678362.gpx','utf8'),'text/xml');
const segments=Array.from(doc.getElementsByTagName('trkseg')).map(s=>Array.from(s.getElementsByTagName('trkpt')).map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon')})));
fs.writeFileSync('public/data/catalog.json',JSON.stringify({main:{points:segments.flat(),segments,source:{kind:'osm',label:'OpenStreetMap',relationId:9678362},difficulty:'Non renseignée'},variants:[],extractedAt:new Date().toISOString()}));
