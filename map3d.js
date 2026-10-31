import {BASEMAPS} from './config.js';
import {voyagePosition} from './voyage.mjs';

const EMPTY={type:'FeatureCollection',features:[]};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let libraryPromise;
function loadLibrary(){
  if(window.maplibregl)return Promise.resolve(window.maplibregl);
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='vendor/maplibre-gl.js';
    script.onload=()=>resolve(window.maplibregl);script.onerror=()=>{libraryPromise=null;script.remove();reject(new Error('De 3D-kaartbibliotheek kon niet laden.'));};document.head.append(script);
  });return libraryPromise;
}
const sourceColor=['match',['get','source'],'mass','#126a85','archis','#b44f37','own','#785a93','#154273'];
const clusterColor=['case',['==',['get','mass'],['get','point_count']],'#126a85',['==',['get','archis'],['get','point_count']],'#b44f37',['==',['get','own'],['get','point_count']],'#785a93','#154273'];

export async function createAtlas3D({container,camera,basemap,onMove,onRecord,onInspect,onError,onWmsStatus}){
  const lib=await loadLibrary();
  const map=new lib.Map({container,center:camera.center,zoom:camera.zoom,pitch:camera.pitch??55,bearing:camera.bearing??-18,maxPitch:70,minZoom:1,maxZoom:19,renderWorldCopies:false,
    canvasContextAttributes:{antialias:true},attributionControl:{compact:true,customAttribution:'Erfgoed: RCE / MaSS'},
    style:{version:8,sources:{},layers:[{id:'sea',type:'background',paint:{'background-color':'#d6e6eb'}}]}});
  try {await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('De 3D-kaart reageert niet op tijd.')),15000);map.once('load',()=>{clearTimeout(timer);resolve();});map.once('error',event=>{clearTimeout(timer);reject(event.error||new Error('3D kon niet starten.'));});});}
  catch(error){map.remove();throw error;}
  const clusterLabels=new Map();let labelsFrame,recordsById=new Map(),baseKey=null,pirate=null,visible=true,sourceErrors=new Set();
  map.addControl(new lib.NavigationControl({visualizePitch:true}),'top-right');
  map.addControl(new lib.ScaleControl({unit:'metric'}),'bottom-left');
  map.getCanvas().setAttribute('aria-label','3D-erfgoedkaart. Gebruik de resultatenlijst voor objectinformatie. Pijltjestoetsen verplaatsen de kaart; Shift met pijltjestoetsen draait of kantelt.');
  const nav=map.getContainer();
  for(const [selector,label] of [['.maplibregl-ctrl-zoom-in','Inzoomen'],['.maplibregl-ctrl-zoom-out','Uitzoomen'],['.maplibregl-ctrl-compass','Noorden boven en kanteling herstellen']]){const el=nav.querySelector(selector);if(el){el.setAttribute('aria-label',label);el.title=label;}}
  map.addSource('atlas-records',{type:'geojson',data:EMPTY,cluster:true,clusterRadius:42,clusterMaxZoom:14,clusterProperties:{mass:['+',['case',['==',['get','source'],'mass'],1,0]],archis:['+',['case',['==',['get','source'],'archis'],1,0]],own:['+',['case',['==',['get','source'],'own'],1,0]]}});
  map.addLayer({id:'atlas-clusters',type:'circle',source:'atlas-records',filter:['has','point_count'],paint:{'circle-color':clusterColor,'circle-radius':['step',['get','point_count'],16,10,20,100,25],'circle-stroke-width':4,'circle-stroke-color':'#ffffff','circle-stroke-opacity':.85}});
  map.addLayer({id:'atlas-points',type:'circle',source:'atlas-records',filter:['!', ['has','point_count']],paint:{'circle-color':sourceColor,'circle-radius':6,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
  map.addSource('atlas-selection',{type:'geojson',data:EMPTY});
  map.addLayer({id:'atlas-selected-area',type:'fill',source:'atlas-selection',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#ffb612','fill-opacity':.22}});
  map.addLayer({id:'atlas-selected-edge',type:'line',source:'atlas-selection',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#c67900','line-width':3}});
  map.addLayer({id:'atlas-selected-point',type:'circle',source:'atlas-selection',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':12,'circle-color':'#ffb612','circle-opacity':.25,'circle-stroke-width':3,'circle-stroke-color':'#c67900'}});
  function updateLabels(){
    if(!visible)return;const seen=new Set();
    for(const f of map.querySourceFeatures('atlas-records')){
      const p=f.properties;if(!p.cluster||seen.has(p.cluster_id))continue;
      seen.add(p.cluster_id);let marker=clusterLabels.get(p.cluster_id);
      if(!marker){const el=document.createElement('span');el.className='gl-cluster-count';el.setAttribute('aria-hidden','true');marker=new lib.Marker({element:el,anchor:'center'});clusterLabels.set(p.cluster_id,marker);}
      marker.getElement().textContent=Number(p.point_count).toLocaleString('nl-NL');marker.setLngLat(f.geometry.coordinates).addTo(map);
    }
    for(const [id,marker] of clusterLabels)if(!seen.has(id)){marker.remove();clusterLabels.delete(id);}
  }
  function scheduleLabels(){cancelAnimationFrame(labelsFrame);labelsFrame=requestAnimationFrame(updateLabels);}
  map.on('sourcedata',event=>{if(event.sourceId==='atlas-records')scheduleLabels();if(event.sourceId?.startsWith('context-')&&event.isSourceLoaded&&!sourceErrors.has(event.sourceId))onWmsStatus?.(event.sourceId.slice(8),'Kaartbeeld geladen');});
  map.on('moveend',()=>{scheduleLabels();if(visible)onMove?.();});
  map.on('error',event=>{const source=event.sourceId;if(source?.startsWith('context-')){sourceErrors.add(source);onWmsStatus?.(source.slice(8),'Deels / niet geladen');}else if(!sourceErrors.has(source||'map')){sourceErrors.add(source||'map');onError?.('Een kaartbeeld kon niet laden. De brongegevens blijven beschikbaar.');}});
  map.on('webglcontextlost',()=>onError?.('De 3D-weergave is onderbroken. Je kunt verder in 2D.'));
  map.on('click',async event=>{
    const features=map.queryRenderedFeatures(event.point,{layers:['atlas-clusters','atlas-points']});
    if(features.length){const f=features[0];if(f.properties.cluster){try{const zoom=await map.getSource('atlas-records').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom,duration:reducedMotion()?0:500});}catch{/* Source may have changed while expanding. */}}
      else {const r=recordsById.get(f.properties.id);if(r)onRecord(r);}return;}
    onInspect?.({latlng:{lat:event.lngLat.lat,lng:event.lngLat.lng}});
  });
  map.on('mousemove',event=>{map.getCanvas().style.cursor=map.queryRenderedFeatures(event.point,{layers:['atlas-clusters','atlas-points']}).length?'pointer':'';});
  function setBase(key){
    if(key===baseKey)return;baseKey=key;const cfg=BASEMAPS[key];
    if(map.getLayer('basemap'))map.removeLayer('basemap');if(map.getSource('basemap'))map.removeSource('basemap');
    map.addSource('basemap',{type:'raster',tiles:[cfg.url],tileSize:256,maxzoom:cfg.maxZoom,attribution:cfg.attribution,...(cfg.netherlands?{bounds:[2.7,50.5,7.7,54]}:{})});
    map.addLayer({id:'basemap',type:'raster',source:'basemap',paint:{'raster-fade-duration':reducedMotion()?0:200}},map.getStyle().layers[1]?.id);
  }
  function setWms(config,enabled){
    const id=`context-${config.id}`;
    if(!enabled){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);sourceErrors.delete(id);return;}
    if(map.getSource(id))return;
    const url=new URL(config.url);url.search=new URLSearchParams({service:'WMS',request:'GetMap',version:'1.1.1',layers:config.layer,styles:config.style,format:'image/png',transparent:'true',srs:'EPSG:3857',width:256,height:256});
    map.addSource(id,{type:'raster',tiles:[url.href+'&bbox={bbox-epsg-3857}'],tileSize:256,maxzoom:19,attribution:'Context: RCE / Erfgoedatlas'});
    onWmsStatus?.(config.id,'Kaartbeeld laden…');
    map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':.7,'raster-fade-duration':0}},'atlas-clusters');
  }
  setBase(basemap);
  return {
    map,
    setBase,setWms,
    setRecords(records){recordsById=new Map(records.map(r=>[r.id,r]));map.getSource('atlas-records').setData({type:'FeatureCollection',features:records.filter(r=>r.point&&Math.abs(r.point[1])<85).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.point},properties:{id:r.id,source:r.source}}))});},
    setSelection(feature){map.getSource('atlas-selection').setData(feature||EMPTY);},
    setVisible(value){visible=value;pirate?.setHidden(!value);if(value){map.resize();scheduleLabels();}},
    getCamera(){const c=map.getCenter();return {center:[c.lng,c.lat],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()};},
    setCamera(camera){map.jumpTo(camera);},
    fitBounds(bbox,detail=false){map.fitBounds([[bbox[0],bbox[1]],[bbox[2],bbox[3]]],{maxZoom:detail?13:undefined,padding:detail?{top:80,bottom:70,left:30,right:innerWidth<=760?30:365}:35,duration:reducedMotion()?0:600});},
    async startPirate(){
      if(!pirate){const {createPirateLayer}=await import('./pirate-ship.js');pirate=createPirateLayer(lib,{paused:reducedMotion()});map.addLayer(pirate);}
      pirate.setHidden(!visible);return {paused:pirate.clock.paused};
    },
    focusPirate(){const p=voyagePosition(pirate?.clock.seconds||0);map.easeTo({center:[p.lng+.15,p.lat-.05],zoom:8.3,pitch:55,bearing:-24,padding:{top:0,left:0,right:0,bottom:70},duration:reducedMotion()?0:1300});},
    pausePirate(value){pirate?.setPaused(value);},
    stopPirate(){if(pirate){map.removeLayer(pirate.id);pirate=null;}},
    destroy(){cancelAnimationFrame(labelsFrame);for(const marker of clusterLabels.values())marker.remove();map.remove();}
  };
}
