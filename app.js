import {SOURCES,WMS_LAYERS,BASEMAPS} from './config.js';
import {TYPE_LABELS,formatYear,normalizeMass,normalizeArchis,normalizeOwn,filterRecords,recordsCSV,recordsGeoJSON} from './core.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('nl-NL');
const date=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'onbekend':d.toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});};
const sourceNames={mass:'MaSS',archis:'Archis openbaar',own:'Eigen gegevens'};
const colors={mass:'#126a85',archis:'#b44f37',own:'#785a93'};
const state={q:'',type:'',period:'all',sources:{mass:true,archis:true,own:true},inView:true,basemap:'light'};
let records=[],massRows=[],archisCollection=null,manifest=null,map,clusters,highlight,baseLayer,selected=null,resultLimit=50,toastTimer,noticeTimer,viewTimer;
let snapshotDates={},sourceErrors={},loadReady=false,inspectionSequence=0;
const activeWms=new Map();
const hash=new URLSearchParams(location.hash.slice(1));
state.q=(hash.get('q')||'').slice(0,300);state.type=Object.hasOwn(TYPE_LABELS,hash.get('type'))?hash.get('type'):'';
state.period=['all','ancient','medieval','early','modern','unknown'].includes(hash.get('period'))?hash.get('period'):'all';
state.basemap=Object.hasOwn(BASEMAPS,hash.get('base'))?hash.get('base'):'light';state.sources.mass=hash.get('mass')!=='0';state.sources.archis=hash.get('archis')!=='0';state.inView=hash.get('view')!=='0';

function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function notice(message,duration=7000){clearTimeout(noticeTimer);$('map-notice').textContent=message;$('map-notice').hidden=false;if(duration)noticeTimer=setTimeout(()=>$('map-notice').hidden=true,duration);}
function plainText(value){if(typeof value==='object')return JSON.stringify(value);return String(value??'').replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').trim();}
function openDialog(id){if(id==='export-dialog')$('export-summary').textContent=`${fmt(visibleRecords().length)} bronrecords in de huidige selectie.`;$(id).showModal();}
async function jsonFetch(url,timeout=25000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{signal:controller.signal,credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const d=await response.json();if(d?.error)throw new Error(typeof d.error==='string'?d.error:d.error.message||'Bronfout');return d;}finally{clearTimeout(timer);}}
function bounds(){const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
function visibleRecords(){return filterRecords(records,state,bounds());}
function sourceMode(key){if(sourceErrors[key])return 'niet beschikbaar';return snapshotDates[key]?.live?`live opgehaald op ${date(snapshotDates[key].at)}`:`momentopname ${date(snapshotDates[key]?.at||manifest?.retrieved_at)}`;}

function initMap(){
  const lat=Number(hash.get('lat')),lon=Number(hash.get('lon')),z=Number(hash.get('z'));
  const valid=hash.has('lat')&&hash.has('lon')&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=80&&Math.abs(lon)<=180;
  map=L.map('map',{zoomControl:false,preferCanvas:true,minZoom:2,maxZoom:19,worldCopyJump:false,attributionControl:true,fadeAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches}).setView(valid?[lat,lon]:[52.55,5.1],valid&&z>=2&&z<=19?z:7);
  L.control.zoom({position:'topright',zoomInTitle:'Inzoomen',zoomOutTitle:'Uitzoomen'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');map.attributionControl.addAttribution('Erfgoed: RCE / MaSS');
  setBasemap(state.basemap);
  clusters=L.markerClusterGroup({maxClusterRadius:43,disableClusteringAtZoom:15,showCoverageOnHover:false,spiderfyOnMaxZoom:true,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,iconCreateFunction:cluster=>{const children=cluster.getAllChildMarkers(),sources=new Set(children.map(m=>m._atlasRecord.source)),kind=sources.size===1?[...sources][0]:'mixed',n=cluster.getChildCount(),size=n>99?48:n>9?42:36;return L.divIcon({html:fmt(n),className:`cluster-icon ${kind}`,iconSize:L.point(size,size)});}}).addTo(map);
  highlight=L.geoJSON(null,{style:{color:'#c67900',weight:3,fillColor:'#ffb612',fillOpacity:.15},pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:12,color:'#c67900',weight:3,fillColor:'#ffb612',fillOpacity:.25}),interactive:false}).addTo(map);
  map.on('moveend',()=>{if(loadReady)renderResults();updateRegionButtons();clearTimeout(viewTimer);viewTimer=setTimeout(saveView,200);});
  map.on('click',inspectContext);updateRegionButtons();
}
function setBasemap(key){
  if(baseLayer)map.removeLayer(baseLayer);state.basemap=key;$('basemap').value=key;
  const cfg=BASEMAPS[key];baseLayer=L.tileLayer(cfg.url,{maxZoom:cfg.maxZoom,attribution:cfg.attribution,keepBuffer:2,bounds:cfg.netherlands?[[50.5,2.7],[54,7.7]]:undefined});
  let warned=false;baseLayer.on('tileerror',()=>{if(!warned){warned=true;notice('Achtergrondkaart niet bereikbaar. Kies eventueel een andere achtergrond.');}});baseLayer.addTo(map);baseLayer.bringToBack();
}
function updateRegionButtons(){const b=map.getBounds(),nl=map.getZoom()>=6&&b.contains([52.2,5.3]);$('region-nl').classList.toggle('selected',nl);$('region-world').classList.toggle('selected',map.getZoom()<6);}
function buildWmsControls(){
  $('wms-layers').innerHTML=WMS_LAYERS.map(c=>`<div class="wms-row"><label class="layer-row"><input type="checkbox" id="wms-${c.id}"><span class="layer-symbol" style="background:${c.color}33;border-color:${c.color}"></span><span class="layer-copy"><strong>${esc(c.title)}</strong><small>${esc(c.subtitle)}</small></span></label><div class="wms-meta"><span id="wms-status-${c.id}">Uitgeschakeld</span><button id="legend-button-${c.id}" aria-expanded="false" aria-controls="legend-${c.id}">Legenda</button></div><div class="wms-legend" id="legend-${c.id}" hidden></div></div>`).join('');
  for(const c of WMS_LAYERS){
    $(`wms-${c.id}`).addEventListener('change',e=>toggleWms(c,e.target.checked));
    $(`legend-button-${c.id}`).addEventListener('click',()=>{const el=$(`legend-${c.id}`);el.hidden=!el.hidden;$(`legend-button-${c.id}`).setAttribute('aria-expanded',String(!el.hidden));if(!el.hidden&&!el.childElementCount){const img=document.createElement('img');img.alt=`Legenda ${c.title}`;const u=new URL(c.url);u.search=new URLSearchParams({service:'WMS',request:'GetLegendGraphic',version:'1.1.1',format:'image/png',layer:c.layer,style:c.style});img.src=u;img.addEventListener('error',()=>{el.textContent='Legenda kon niet worden geladen. Raadpleeg de Erfgoedatlas.';});el.append(img);}});
    if((hash.get('layers')||'').split(',').includes(c.id)){$(`wms-${c.id}`).checked=true;toggleWms(c,true);}
  }
}
function toggleWms(c,enabled){
  if(!enabled){const prev=activeWms.get(c.id);if(prev)map.removeLayer(prev.layer);activeWms.delete(c.id);$(`wms-status-${c.id}`).textContent='Uitgeschakeld';saveView();return;}
  const layer=L.tileLayer.wms(c.url,{layers:c.layer,styles:c.style,format:'image/png',transparent:true,version:'1.1.1',opacity:.7,attribution:'Context: RCE / Erfgoedatlas',maxZoom:19});
  let errors=0;layer.on('loading',()=>{errors=0;$(`wms-status-${c.id}`).textContent='Kaartbeeld laden…';});layer.on('tileerror',()=>{errors++;$(`wms-status-${c.id}`).textContent='Bron niet bereikbaar';});layer.on('load',()=>{$(`wms-status-${c.id}`).textContent=errors?'Deels / niet geladen':'Kaartbeeld geladen';});
  activeWms.set(c.id,{config:c,layer});layer.addTo(map);layer.bringToBack();if(baseLayer)baseLayer.bringToBack();saveView();
}
function rebuildMarkers(){
  clusters.clearLayers();
  const filtered=filterRecords(records,{...state,inView:false});
  const markers=filtered.filter(r=>r.point&&Math.abs(r.point[1])<85).map(r=>{const marker=L.marker([r.point[1],r.point[0]],{title:`${r.name} · ${sourceNames[r.source]}`,alt:r.name,icon:L.divIcon({className:'point-wrapper',html:`<div class="point-marker ${r.source}" style="width:100%;height:100%"></div>`,iconSize:[13,13],iconAnchor:[6,6]})});marker._atlasRecord=r;const tip=document.createElement('span');tip.textContent=r.name;marker.bindTooltip(tip,{direction:'top',offset:[0,-7]});marker.on('click',()=>showRecord(r,false));return marker;});
  clusters.addLayers(markers);renderResults();saveView();
}
function renderResults(){
  const list=visibleRecords();$('result-tab-count').textContent=fmt(list.length);$('result-heading').textContent=`${fmt(list.length)} bronrecords`;
  $('result-scope').textContent=state.inView?'Binnen het kaartbeeld, voor gebieden op basis van hun begrenzing. Contextlagen tellen niet mee.':'In de volledige ingelezen gegevens. Contextlagen tellen niet mee.';
  const ordered=list.toSorted?list.toSorted((a,b)=>a.name.localeCompare(b.name,'nl',{numeric:true})):list.slice().sort((a,b)=>a.name.localeCompare(b.name,'nl',{numeric:true}));
  $('results-list').innerHTML=ordered.length?ordered.slice(0,resultLimit).map(r=>`<button class="result-card" data-record="${esc(r.id)}"><span class="result-topline"><span class="source-${r.source}">${esc(sourceNames[r.source])}</span><span>${r.source==='mass'&&r.yearEnd!==null?esc(formatYear(r.yearEnd)):r.source==='archis'?'Onderzoeksgebied':''}</span></span><strong>${esc(r.name)}</strong><small>${esc(r.location||r.subtype)}</small></button>`).join(''):'<div class="empty-state"><strong>Geen records gevonden</strong>Pas je zoekterm of filters aan, zoom uit, of schakel ‘Alleen in dit kaartbeeld’ uit.</div>';
  $('results-list').querySelectorAll('[data-record]').forEach(button=>button.addEventListener('click',()=>{const r=records.find(r=>r.id===button.dataset.record);if(r)showRecord(r,true);}));
  $('more-results').hidden=list.length<=resultLimit;
  const total=filterRecords(records,{...state,inView:false}).length;
  $('data-status').textContent=`${fmt(list.length)} in selectie · ${fmt(total)} met deze filters · ${sourceErrors.mass||sourceErrors.archis?'Een bron kon niet laden':'Bronrecords, zonder ontdubbeling'}`;
}
function switchTab(which){for(const tab of ['layers','results']){$(`${tab}-panel`).hidden=tab!==which;$(`${tab}-tab`).setAttribute('aria-selected',String(tab===which));}$('layers-tab').tabIndex=which==='layers'?0:-1;$('results-tab').tabIndex=which==='results'?0:-1;}
function factsHTML(rows){return '<dl>'+rows.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')+'</dl>';}
function yearSpan(first,last){if(first===null)return 'Onbekend';return first===last?formatYear(first):`${formatYear(first)} – ${formatYear(last)}`;}
function closeDetail(){inspectionSequence++;selected=null;$('detail').hidden=true;highlight.clearLayers();}
function showRecord(r,zoom){
  inspectionSequence++;selected=r;$('detail-source').textContent=sourceNames[r.source];$('detail').hidden=false;
  const p=r.properties,rows=[['Bron-ID',r.sourceId],['Soort',r.subtype]];
  if(r.source==='mass')rows.push(['Dateringsbereik',yearSpan(r.yearStart,r.yearEnd)],['Bouw / ingebruikname',p.firstyear===null||p.firstyear===undefined?'Onbekend':formatYear(p.firstyear)+(p.firstyearend?' – '+formatYear(p.firstyearend):'')],['Einde gebruik / vergaan',p.lastyear===null||p.lastyear===undefined?'Onbekend':formatYear(p.lastyear)+(p.lastyearend?' – '+formatYear(p.lastyearend):'')],['Ontdekt',p.discovery?formatYear(p.discovery):'Onbekend']);
  if(r.source==='archis')rows.push(['Meldingsnummer',p.meldingsnummer],['Start onderzoek',p.startdatum_onderzoek||'Onbekend'],['Status',p.status],['Bodemtype',p.bodemtype],['Uitvoerder / melder',p.melder],['Gemeente',p.gemeente],['Provincie',p.provincie]);
  if(r.ncn)rows.push(['Nationaal Contact Nummer',r.ncn]);
  if(r.point)rows.push([r.geometry.type==='Point'?'Coördinaat (WGS84)':'Overzichtspunt (WGS84)',`${Math.abs(r.point[1]).toFixed(5)}° ${r.point[1]<0?'ZB':'NB'}, ${Math.abs(r.point[0]).toFixed(5)}° ${r.point[0]<0?'WL':'OL'}`]);
  if(r.source==='own')for(const [k,v] of Object.entries(p).slice(0,35)){if(v!==null&&typeof v!=='object')rows.push([k,v]);}
  const sourceLink=r.url?`<a class="source-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${r.source==='mass'?'Lees het verhaal op MaSS':'Open Archis · aanmelding nodig'} ↗</a>`:'';
  const sourceNote=r.source==='archis'?`Dit is een openbaar onderzoeksgebied. Zoek in Archis op meldingsnummer ${r.sourceId} voor het volledige dossier.`:r.source==='mass'?'De bron bevat meer verhaal, afbeeldingen en eventuele aanvullingen. Bron: MaSS / RCE · CC BY-SA 4.0.':'Gegevens uit je lokale bestand; niet opgeslagen of gedeeld.';
  $('detail-body').innerHTML=`<div class="eyebrow">${esc(r.source==='archis'?'ARCHEOLOGISCH ONDERZOEK':r.source==='own'?'EIGEN GEGEVENS':'MARITIEM ERFGOED')}</div><h2 id="detail-title" tabindex="-1">${esc(r.name)}</h2><p class="place">${esc(r.location||'Geen plaatsnaam vermeld')}</p>${factsHTML(rows)}${sourceLink}<p class="note">${esc(r.coordinateMeaning)}. ${esc(sourceNote)}</p><p class="field-help">${r.source==='own'?'Lokaal bestand':esc(sourceMode(r.source))}</p>`;
  highlight.clearLayers();if(r.geometry)highlight.addData({type:'Feature',geometry:r.geometry,properties:{}});highlight.bringToFront();
  if(zoom&&r.bounds){const mobile=innerWidth<=760;map.fitBounds([[r.bounds[1],r.bounds[0]],[r.bounds[3],r.bounds[2]]],{maxZoom:13,paddingTopLeft:[30,70],paddingBottomRight:mobile?[30,30]:[370,70],animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});}
  $('workspace').classList.remove('panel-open');$('mobile-panel-toggle').textContent='Zoeken & kaartlagen';$('mobile-panel-toggle').setAttribute('aria-expanded','false');
  if(zoom)$('detail-title').focus({preventScroll:true});
}
async function inspectContext(event){
  if(!activeWms.size)return;const token=++inspectionSequence;notice('Contextlagen op deze plek bevragen…',0);
  const size=map.getSize(),point=map.latLngToContainerPoint(event.latlng),b=map.getBounds(),sw=L.CRS.EPSG3857.project(b.getSouthWest()),ne=L.CRS.EPSG3857.project(b.getNorthEast());
  const results=await Promise.allSettled([...activeWms.values()].map(async({config:c})=>{const u=new URL(c.url);u.search=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetFeatureInfo',layers:c.layer,query_layers:c.layer,styles:c.style,format:'image/png',info_format:'application/json',srs:'EPSG:3857',bbox:[sw.x,sw.y,ne.x,ne.y].join(','),width:Math.round(size.x),height:Math.round(size.y),x:Math.round(point.x),y:Math.round(point.y),feature_count:10});const data=await jsonFetch(u,15000);return (data.features||[]).map(f=>({feature:f,config:c}));}));
  if(token!==inspectionSequence)return;const features=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value),failures=results.filter(r=>r.status==='rejected').length;
  if(!features.length){notice(failures?'Objectinformatie kon niet van alle bronnen worden opgehaald. De kaartbeelden kunnen wel beschikbaar zijn.':'Geen contextobject op deze plek gevonden.');return;}
  $('map-notice').hidden=true;selected=null;$('detail').hidden=false;$('detail-source').textContent='Erfgoedatlas · live objectinformatie';
  function draw(index){const {feature:f,config:c}=features[index],p=f.properties||{},title=p.toponiem||p.naam||p.rijksmonument_nummer||p.monumentnummer||c.title;highlight.clearLayers();if(f.geometry)highlight.addData(f);const rows=Object.entries(p).filter(([,v])=>v!==null&&v!=='').map(([k,v])=>[k.replaceAll('_',' '),plainText(v)]);
    $('detail-body').innerHTML=`${features.length>1?`<label for="context-feature" class="field-help">${features.length} objecten gevonden</label><select id="context-feature" class="feature-select">${features.map((v,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(v.config.title)} · ${i+1}</option>`).join('')}</select>`:''}<div class="eyebrow">${esc(c.title)}</div><h2 id="detail-title">${esc(plainText(title))}</h2>${factsHTML(rows)}<a class="source-link" href="${SOURCES.atlas.url}" target="_blank" rel="noopener noreferrer">Bekijk in de Erfgoedatlas ↗</a><p class="note">Live bevraagd op ${esc(date(new Date()))}. ${c.id==='amk'?'AMK 2014 is een historische inventarisatie, geen actueel beschermingsregister.':''} ${failures?'Niet alle actieve lagen konden worden bevraagd.':''}</p>`;
    $('context-feature')?.addEventListener('change',e=>draw(Number(e.target.value)));
  }draw(0);
}
function saveView(){
  if(!map)return;const c=map.getCenter(),p=new URLSearchParams({lat:c.lat.toFixed(5),lon:c.lng.toFixed(5),z:String(map.getZoom())});
  if(state.q)p.set('q',state.q);if(state.type)p.set('type',state.type);if(state.period!=='all')p.set('period',state.period);if(!state.sources.mass)p.set('mass','0');if(!state.sources.archis)p.set('archis','0');if(!state.inView)p.set('view','0');if(state.basemap!=='light')p.set('base',state.basemap);if(activeWms.size)p.set('layers',[...activeWms.keys()].join(','));history.replaceState(null,'',`${location.pathname}${location.search}#${p}`);
}
function renderSourceSummary(){
  $('source-summary').innerHTML=`<div class="source-card"><span class="source-tag">OPENBARE API</span><h3>MaSS · verhalen en vindplaatsen</h3><p>${fmt(records.filter(r=>r.source==='mass').length)} records uit de Nederlandstalige lijst-API, wereldwijd. Namen, typen, locaties en jaartallen zijn meegeleverd. Uitgebreide verhalen en afbeeldingen blijven bij de oorspronkelijke bron.</p><p class="source-meta">${esc(sourceMode('mass'))} · CC BY-SA 4.0 · volledigheid: alle records uit de opgehaalde lijst</p><a href="https://mass.cultureelerfgoed.nl/api/" target="_blank" rel="noopener noreferrer">API en broninformatie ↗</a></div><div class="source-card"><span class="source-tag">OPENBARE SELECTIE</span><h3>Archis · onderzoek op waterbodems</h3><p>${fmt(records.filter(r=>r.source==='archis').length)} afgeronde, openbare onderzoeksmeldingen uit de RCE-WFS, geselecteerd op <strong>bodemtype = Waterbodem</strong>. Inclusief oorspronkelijke onderzoekscontouren. Onderzoeken die anders zijn gecodeerd vallen buiten deze selectie.</p><p class="source-meta">${esc(sourceMode('archis'))} · de volledige Archis-dossiers zijn niet opgenomen</p><a href="https://data.geo.cultureelerfgoed.nl/openbaar/wfs?service=WFS&request=GetCapabilities" target="_blank" rel="noopener noreferrer">Bekijk de openbare RCE-dienst ↗</a></div>`;
  $('mass-count').textContent=fmt(records.filter(r=>r.source==='mass').length);$('archis-count').textContent=fmt(records.filter(r=>r.source==='archis').length);
}
async function loadData(){
  const [meta,mass,archis]=await Promise.allSettled([jsonFetch('data/manifest.json'),jsonFetch(SOURCES.mass.file),jsonFetch(SOURCES.archis.file,40000)]);
  if(meta.status==='fulfilled')manifest=meta.value;
  if(mass.status==='fulfilled'){try{massRows=mass.value;records.push(...normalizeMass(massRows));snapshotDates.mass={at:manifest?.sources?.mass?.retrieved_at||manifest?.retrieved_at};}catch(e){sourceErrors.mass=e.message;}}else sourceErrors.mass=mass.reason.message;
  if(archis.status==='fulfilled'){try{archisCollection=archis.value;records.push(...normalizeArchis(archisCollection));snapshotDates.archis={at:manifest?.sources?.archis?.retrieved_at||manifest?.retrieved_at};}catch(e){sourceErrors.archis=e.message;}}else sourceErrors.archis=archis.reason.message;
  $('snapshot-label').textContent=manifest?`Momentopname ${date(manifest.retrieved_at)}`:'Momentopname · datum niet beschikbaar';
  renderSourceSummary();loadReady=true;rebuildMarkers();
  if(Object.keys(sourceErrors).length)notice(`Niet alle gegevens konden laden (${Object.keys(sourceErrors).map(k=>sourceNames[k]).join(', ')}). Open de site via een webserver of probeer opnieuw.`,0);
}
// MaSS documents a JSONP wrapper for the list endpoint. This avoids a CORS proxy.
function refreshMass(){return new Promise((resolve,reject)=>{
  const name=`atlasMass${Date.now()}`,script=document.createElement('script');let finished=false;
  const cleanup=()=>{clearTimeout(timer);script.remove();delete window[name];};
  const timer=setTimeout(()=>{if(!finished){finished=true;cleanup();reject(new Error('MaSS reageert niet op tijd.'));}},20000);
  window[name]=data=>{if(finished)return;finished=true;cleanup();resolve(data);};
  script.onerror=()=>{if(!finished){finished=true;cleanup();reject(new Error('MaSS is niet bereikbaar.'));}};
  script.src=`${SOURCES.mass.api}${encodeURIComponent(name+'()')}`;document.head.append(script);
});}
async function refreshArchis(){
  let all=[],start=0,total=null;const seen=new Set();
  for(let page=0;page<100;page++){
    const u=new URL(SOURCES.archis.api);u.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:SOURCES.archis.typeName,srsName:'EPSG:4326',outputFormat:'application/json',CQL_FILTER:"bodemtype = 'Waterbodem'",count:1000,startIndex:start,sortBy:'meldingsnummer A'});
    const data=await jsonFetch(u,45000);if(!Array.isArray(data.features))throw new Error('Ongeldige Archis-respons.');
    if(Number.isFinite(Number(data.numberMatched)))total=Number(data.numberMatched);
    for(const f of data.features){const id=String(f.properties?.meldingsnummer||f.id);if(seen.has(id))throw new Error('Paginering leverde dubbele records op.');seen.add(id);all.push(f);}
    start+=data.features.length;
    if((total!==null&&start>=total)||data.features.length===0){if(total!==null&&all.length!==total)throw new Error('Onvolledige Archis-respons.');return {type:'FeatureCollection',features:all};}
    if(total===null&&data.features.length<1000)return {type:'FeatureCollection',features:all};
  }throw new Error('Te veel resultaten; werk de momentopname bij met het updatescript.');
}
async function refreshData(){
  const button=$('refresh-data');button.disabled=true;$('refresh-status').textContent='MaSS en Archis ophalen…';
  const responses=await Promise.allSettled([refreshMass(),refreshArchis()]);const messages=[];
  for(const [i,key] of ['mass','archis'].entries()){
    try{if(responses[i].status==='rejected')throw responses[i].reason;const data=responses[i].value,normalized=key==='mass'?normalizeMass(data):normalizeArchis(data);records=records.filter(r=>r.source!==key).concat(normalized);if(key==='mass')massRows=data;else archisCollection=data;delete sourceErrors[key];snapshotDates[key]={at:new Date().toISOString(),live:true};messages.push(`${sourceNames[key]} bijgewerkt (${fmt(normalized.length)})`);}catch(e){messages.push(`${sourceNames[key]} niet bijgewerkt; bestaande gegevens behouden`);}
  }
  renderSourceSummary();rebuildMarkers();$('snapshot-label').textContent='Bekijk brondata en ophaaldatum per bron';$('refresh-status').textContent=messages.join(' · ');button.disabled=false;
}
function download(name,content,mime){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;(document.querySelector('dialog[open]')||document.body).append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},3000);}
function wireEvents(){
  $('search').value=state.q;$('heritage-type').value=state.type;$('period').value=state.period;$('in-view').checked=state.inView;for(const key of ['mass','archis','own'])$(`source-${key}`).checked=state.sources[key];$('clear-search').hidden=!state.q;
  $('search').addEventListener('input',e=>{state.q=e.target.value;resultLimit=50;$('clear-search').hidden=!state.q;rebuildMarkers();if(state.q)switchTab('results');});$('clear-search').addEventListener('click',()=>{$('search').value='';state.q='';$('clear-search').hidden=true;rebuildMarkers();$('search').focus();});
  for(const [id,key] of [['heritage-type','type'],['period','period']])$(id).addEventListener('change',e=>{state[key]=e.target.value;resultLimit=50;rebuildMarkers();});
  for(const key of ['mass','archis','own'])$(`source-${key}`).addEventListener('change',e=>{state.sources[key]=e.target.checked;resultLimit=50;rebuildMarkers();});
  $('in-view').addEventListener('change',e=>{state.inView=e.target.checked;resultLimit=50;renderResults();saveView();});
  for(const key of ['layers','results'])$(`${key}-tab`).addEventListener('click',()=>switchTab(key));
  document.querySelector('.panel-tabs').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=$('layers-tab').getAttribute('aria-selected')==='true'?'results':'layers';switchTab(next);$(`${next}-tab`).focus();}});
  $('more-results').addEventListener('click',()=>{resultLimit+=50;renderResults();});
  $('reset').addEventListener('click',()=>{state.q='';state.type='';state.period='all';state.sources={mass:true,archis:true,own:true};state.inView=true;$('search').value='';$('heritage-type').value='';$('period').value='all';$('in-view').checked=true;$('clear-search').hidden=true;for(const k of ['mass','archis','own'])$(`source-${k}`).checked=true;for(const c of WMS_LAYERS){$(`wms-${c.id}`).checked=false;toggleWms(c,false);}closeDetail();resultLimit=50;rebuildMarkers();toast('Bronkeuze en filters hersteld.');});
  $('region-nl').addEventListener('click',()=>{map.fitBounds([[50.7,2.4],[54.2,7.4]],{padding:[20,20]});closeDetail();if(state.basemap==='topo')setBasemap('light');});
  $('region-world').addEventListener('click',()=>{setBasemap('topo');map.setView([20,10],2);closeDetail();});
  $('basemap').addEventListener('change',e=>{setBasemap(e.target.value);if(e.target.value==='light'&&map.getZoom()<6)notice('De lichte PDOK-kaart dekt Nederland. Kies topografie voor wereldwijde dekking.');saveView();});
  $('detail-close').addEventListener('click',closeDetail);
  $('share').addEventListener('click',async()=>{saveView();try{await navigator.clipboard.writeText(location.href);toast('Kaartlink met positie en filters gekopieerd.');}catch{$('share-link').value=location.href;openDialog('share-dialog');$('share-link').select();}});
  document.querySelectorAll('[data-dialog]').forEach(b=>b.addEventListener('click',()=>openDialog(b.dataset.dialog)));
  document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.dialog-close').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});});
  $('refresh-data').addEventListener('click',refreshData);
  $('export-geojson').addEventListener('click',()=>{const list=visibleRecords();download('erfgoed-selectie.geojson',JSON.stringify(recordsGeoJSON(list,snapshotDates),null,2),'application/geo+json');toast(`${fmt(list.length)} records geëxporteerd als GeoJSON.`);});
  $('export-csv').addEventListener('click',()=>{const list=visibleRecords();download('erfgoed-selectie.csv',recordsCSV(list),'text/csv;charset=utf-8');toast(`${fmt(list.length)} records geëxporteerd als CSV.`);});
  $('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw new Error('Het bestand is groter dan 20 MB.');const own=normalizeOwn(JSON.parse(await file.text()));records=records.filter(r=>r.source!=='own').concat(own);state.sources.own=true;$('source-own').checked=true;$('import-layer').hidden=false;$('own-legend').hidden=false;$('own-count').textContent=`${fmt(own.length)} objecten · ${file.name}`;rebuildMarkers();const located=own.filter(r=>r.bounds);if(located.length){const bb=[Math.min(...located.map(r=>r.bounds[0])),Math.min(...located.map(r=>r.bounds[1])),Math.max(...located.map(r=>r.bounds[2])),Math.max(...located.map(r=>r.bounds[3]))];map.fitBounds([[bb[1],bb[0]],[bb[3],bb[2]]],{maxZoom:13,padding:[30,30]});}toast(`${fmt(own.length)} eigen objecten lokaal ingelezen.`);}catch(error){toast(`Import niet gelukt: ${error.message}`);}finally{e.target.value='';}});
  $('remove-import').addEventListener('click',()=>{records=records.filter(r=>r.source!=='own');$('import-layer').hidden=true;$('own-legend').hidden=true;if(selected?.source==='own')closeDetail();rebuildMarkers();toast('Eigen gegevens uit dit venster verwijderd.');});
  $('mobile-panel-toggle').addEventListener('click',()=>{const open=$('workspace').classList.toggle('panel-open');$('mobile-panel-toggle').textContent=open?'Sluiten':'Zoeken & kaartlagen';$('mobile-panel-toggle').setAttribute('aria-expanded',String(open));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){closeDetail();$('workspace').classList.remove('panel-open');$('mobile-panel-toggle').textContent='Zoeken & kaartlagen';$('mobile-panel-toggle').setAttribute('aria-expanded','false');}});
}

try{if(!window.L||!L.markerClusterGroup)throw new Error('De lokale kaartbibliotheek is niet geladen.');initMap();buildWmsControls();wireEvents();await loadData();}catch(error){$('data-status').textContent='De atlas kon niet starten.';notice(`Startfout: ${error.message}. Controleer of alle bestanden uit het pakket op de webserver staan.`,0);console.error(error);}
