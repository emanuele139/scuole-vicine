import rings from '../data/milan-boundary.json';
import {metroLines} from '../lib/milan-map';

export function openLocalBasemap(L:any,map:any) {
  if(!map.getPane('local-basemap'))map.createPane('local-basemap').style.zIndex='250';
  const pane='local-basemap';
  const layer=L.layerGroup([], {attribution:'Mappa schematica locale · <a href="https://github.com/codeforgermany/click_that_hood/blob/main/public/data/milan.geojson">Quartieri di Milano</a>'});
  for(const ring of rings)L.polygon(ring.map(([lng,lat])=>[lat,lng]),{pane,interactive:false,color:'#b7c5b1',weight:.7,fillColor:'#e2e8d9',fillOpacity:.55}).addTo(layer);
  for(const line of metroLines)for(const branch of line.branches)L.polyline(branch.map(([lng,lat])=>[lat,lng]),{pane,interactive:false,color:line.color,weight:2,opacity:.6}).addTo(layer);
  for(const [name,lat,lng] of [['Duomo',45.4642,9.191],['San Siro',45.478,9.124],['Navigli',45.450,9.173],['Stazione Centrale',45.486,9.205]] as const){
    L.marker([lat,lng],{pane,interactive:false,icon:L.divIcon({className:'local-map-label',html:name,iconSize:[100,20],iconAnchor:[50,10]})}).addTo(layer);
  }
  return layer.addTo(map);
}
