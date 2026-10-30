export const SOURCES = {
  mass: {name:'MaSS', url:'https://mass.cultureelerfgoed.nl/', api:'https://mass.cultureelerfgoed.nl/api/v1/list/nl/', file:'data/mass.json'},
  archis: {name:'Archis openbaar', url:'https://archis.cultureelerfgoed.nl/authenticatie/inloggen', api:'https://data.geo.cultureelerfgoed.nl/openbaar/wfs', typeName:'openbaar:archeologische_onderzoeksmeldingen_openbaar_wgs84', file:'data/archis-water.geojson'},
  atlas: {name:'Erfgoedatlas', url:'https://rce.webgis.nl/nl/map/erfgoedatlas'},
  machu: {name:'MACHU', url:'https://geoweb.rijkswaterstaat.nl/Moduleviewer/?app=3d6b415eeabd47d9b3da56ebd686f7cf'}
};
export const WMS_LAYERS = [
  {id:'amk',title:'Archeologische terreinen',subtitle:'AMK 2014 · historische inventarisatie',url:'https://data.geo.cultureelerfgoed.nl/openbaar/wms',layer:'Archeologische_Monumentenkaart_2014',style:'AMK_2014_archeologische_waarde',color:'#9e6a75'},
  {id:'monuments',title:'Archeologische rijksmonumenten',subtitle:'Beschermde monumentcontouren',url:'https://data.geo.cultureelerfgoed.nl/openbaar/wms',layer:'rijksmonumentcontouren',style:'CHOIrijksmonumentdicosArcheologisch',color:'#5b76a1'},
  {id:'potential',title:'Onderzoekspotentieel Noordzee',subtitle:'Paleolandschappen · kaart 2016',url:'https://services.rce.geovoorziening.nl/Noordzee_arch_onderz_potentieel/wms',layer:'noordzee_arch_onderzoekspotentieel_2016',style:'',color:'#9e925e'}
];
export const BASEMAPS = {
  light:{url:'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',maxZoom:19,attribution:'Kaart: <a href="https://www.pdok.nl/" target="_blank" rel="noopener">PDOK / Kadaster</a>',netherlands:true},
  topo:{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'},
  satellite:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:19,attribution:'Beeld: Esri, Maxar, Earthstar Geographics en de GIS User Community'}
};
