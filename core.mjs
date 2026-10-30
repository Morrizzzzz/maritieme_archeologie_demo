export const TYPE_LABELS={wreck:'Scheepswrak',site:'Vindplaats',plane:'Vliegtuigwrak',structure:'Structuur',other:'Overig'};
export const PERIODS={ancient:[-Infinity,499],medieval:[500,1499],early:[1500,1799],modern:[1800,Infinity]};
export function readable(value){const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',eacute:'é',euml:'ë',ouml:'ö',uuml:'ü'};return String(value??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(whole,key)=>{if(key.startsWith('#')){const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):whole;}return entities[key]??whole;});}
export function numeric(value){return value===null||value===undefined||String(value).trim()===''?null:(Number.isFinite(Number(value))?Number(value):null);}
export function formatYear(value){const n=numeric(value);return n===null?'Onbekend':n<0?`${Math.abs(n).toLocaleString('nl-NL')} v.Chr.`:String(n);}
export function geometryBounds(geometry){
  if(!geometry)return null;
  const points=[];
  const visit=c=>{if(!Array.isArray(c))return;if(typeof c[0]==='number'&&typeof c[1]==='number'){if(Number.isFinite(c[0])&&Number.isFinite(c[1]))points.push(c);}else c.forEach(visit);};
  if(geometry.type==='GeometryCollection'){
    const boxes=(geometry.geometries||[]).map(geometryBounds).filter(Boolean);if(!boxes.length)return null;
    return [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
  }
  visit(geometry.coordinates);if(!points.length)return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of points){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return [x0,y0,x1,y1];
}
export function boundsOverlap(a,b){return !b||!!a&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
function finish(record){
  record.bounds=geometryBounds(record.geometry);record.point=record.bounds?[(record.bounds[0]+record.bounds[2])/2,(record.bounds[1]+record.bounds[3])/2]:null;
  record.searchText=[record.name,record.location,record.sourceId,record.ncn,record.subtype,...Object.values(record.properties||{}).filter(v=>typeof v==='string'||typeof v==='number')].join(' ').toLocaleLowerCase('nl-NL');
  return record;
}
export function normalizeMass(rows){
  if(!Array.isArray(rows))throw new Error('De MaSS-respons is geen lijst.');
  const seen=new Set();return rows.map(p=>{
    if(!p||p.id===undefined)throw new Error('MaSS-record zonder ID.');
    const id=String(p.id);if(seen.has(id))throw new Error('Dubbel MaSS-ID in de bron.');seen.add(id);
    const lon=numeric(p.lon),lat=numeric(p.lat),valid=lon!==null&&lat!==null&&Math.abs(lon)<=180&&Math.abs(lat)<=90;
    const years=[p.firstyear,p.firstyearend,p.lastyear,p.lastyearend].map(numeric).filter(v=>v!==null);
    return finish({id:`mass:${id}`,source:'mass',sourceId:id,name:readable(p.name||p.label||`MaSS ${id}`),location:readable(p.location||''),type:p.type||'other',subtype:readable(p.subtype||TYPE_LABELS[p.type]||'Overig'),yearStart:years.length?Math.min(...years):null,yearEnd:years.length?Math.max(...years):null,geometry:valid?{type:'Point',coordinates:[lon,lat]}:null,properties:p,url:`https://mass.cultureelerfgoed.nl/${encodeURIComponent(p.code||id)}`,coordinateMeaning:'Gepubliceerde MaSS-locatie; nauwkeurigheid niet vermeld in de lijst-API',ncn:''});
  });
}
export function normalizeArchis(collection){
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('De Archis-respons is geen GeoJSON FeatureCollection.');
  const seen=new Set();return collection.features.map((f,i)=>{
    const p=f.properties||{},sourceId=String(p.meldingsnummer||f.id||i);if(seen.has(sourceId))throw new Error('Dubbel Archis-meldingsnummer.');seen.add(sourceId);
    return finish({id:`archis:${sourceId}`,source:'archis',sourceId,name:p.naam&&p.naam!=='-'?String(p.naam):`Wateronderzoek ${sourceId}`,location:[p.plaats,p.gemeente].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · '),type:'research',subtype:p.type||'Archeologisch onderzoek',yearStart:null,yearEnd:null,geometry:f.geometry,properties:p,url:'https://archis.cultureelerfgoed.nl/authenticatie/inloggen',coordinateMeaning:'Midden van de begrenzing van het onderzoeksgebied; geen wraklocatie',ncn:p.nationaal_contact_nummer||''});
  });
}
export function normalizeOwn(collection){
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('Kies een GeoJSON FeatureCollection.');
  if(collection.features.length>10000)throw new Error('Maximaal 10.000 objecten per bestand.');
  if(collection.crs&&!/4326|CRS:?84/i.test(JSON.stringify(collection.crs)))throw new Error('Exporteer eerst in WGS84 (EPSG:4326), met lengtegraad vóór breedtegraad.');
  function validGeometry(g){
    if(g===null)return true;if(!g||typeof g!=='object')return false;
    const position=c=>Array.isArray(c)&&c.length>=2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;
    const line=c=>Array.isArray(c)&&c.length>=2&&c.every(position);
    const ring=c=>Array.isArray(c)&&c.length>=4&&c.every(position)&&c[0][0]===c.at(-1)[0]&&c[0][1]===c.at(-1)[1];
    const polygon=c=>Array.isArray(c)&&c.length>0&&c.every(ring);
    const many=(c,p)=>Array.isArray(c)&&c.length>0&&c.every(p);
    switch(g.type){case'Point':return position(g.coordinates);case'MultiPoint':return many(g.coordinates,position);case'LineString':return line(g.coordinates);case'MultiLineString':return many(g.coordinates,line);case'Polygon':return polygon(g.coordinates);case'MultiPolygon':return many(g.coordinates,polygon);case'GeometryCollection':return many(g.geometries,validGeometry);default:return false;}
  }
  return collection.features.map((f,i)=>{
    if(f.type!=='Feature'||!validGeometry(f.geometry))throw new Error(`Object ${i+1}: ongeldige geometrie of coördinaten buiten WGS84-bereik.`);
    const p=f.properties||{};return finish({id:`own:${i}`,source:'own',sourceId:String(p.id||f.id||i+1),name:String(p.naam||p.name||p.title||p.meldingsnummer||`Eigen object ${i+1}`),location:String(p.plaats||p.location||p.gemeente||''),type:'own',subtype:String(p.type||'Eigen gegevens'),yearStart:null,yearEnd:null,geometry:f.geometry,properties:p,url:null,coordinateMeaning:f.geometry?.type==='Point'?'Punt uit eigen bestand':'Midden van de begrenzing; originele geometrie bij selectie',ncn:String(p.nationaal_contact_nummer||p.ncn||'')});
  });
}
export function matchesPeriod(record,period){if(record.source!=='mass'||period==='all')return true;if(period==='unknown')return record.yearStart===null;if(record.yearStart===null)return false;const p=PERIODS[period];return !p||record.yearStart<=p[1]&&record.yearEnd>=p[0];}
export function filterRecords(records,state,bounds=null){const q=state.q.trim().toLocaleLowerCase('nl-NL');return records.filter(r=>state.sources[r.source]&&(!q||r.searchText.includes(q))&&(r.source!=='mass'||!state.type||r.type===state.type)&&matchesPeriod(r,state.period)&&(!state.inView||boundsOverlap(r.bounds,bounds)));}
export function csvCell(value){let s=value===null||value===undefined?'':String(value);if(typeof value!=='number'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function recordsCSV(records){const head=['bron','bron_id','naam','plaats','type','datering_vanaf','datering_tot','lengtegraad','breedtegraad','betekenis_coordinaat','ncn','bron_url'];return '\uFEFF'+[head.map(csvCell).join(';'),...records.map(r=>[r.source,r.sourceId,r.name,r.location,r.subtype,r.yearStart,r.yearEnd,r.point?.[0],r.point?.[1],r.coordinateMeaning,r.ncn,r.url].map(csvCell).join(';'))].join('\r\n');}
export function recordsGeoJSON(records,snapshot){return {type:'FeatureCollection',metadata:{exported_at:new Date().toISOString(),source_snapshot:snapshot,description:'Visuele integratie van bronrecords; geen deduplicatie tussen bronnen. Eigen geometrieën zijn behouden.',mass_license:'https://creativecommons.org/licenses/by-sa/4.0/',attribution:'MaSS en Archis openbaar — Rijksdienst voor het Cultureel Erfgoed; eigen data indien opgenomen.'},features:records.map(r=>({type:'Feature',id:r.id,geometry:r.geometry,properties:{...r.properties,atlas_source:r.source,atlas_source_id:r.sourceId,atlas_title:r.name,atlas_source_url:r.url,atlas_coordinate_meaning:r.coordinateMeaning}}))};}
