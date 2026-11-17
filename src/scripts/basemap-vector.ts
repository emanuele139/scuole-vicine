import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);
export function openVectorBasemap(map:any) {
  return maplibreGL({
    style:'https://tiles.openfreemap.org/styles/liberty',
    attributionControl:{customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · dati &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'},
    interactive:false,
  }).addTo(map);
}
