import { mapsAllowed } from '../lib/consent';
import { BasemapFailover, checkedTileBlob, isBlockedTilePixels } from '../lib/map-health';
import { openLocalBasemap } from './basemap-local';

export function installBasemap(L:any,map:any,onStatus:(message:string)=>void) {
  let activeLayer:any=null;
  let destroyed=false;
  let dispose=()=>{};
  const failover=new BasemapFailover(index=>activate(index));
  function activate(index:number) {
    if(destroyed)return;
    if(index < 2 && !mapsAllowed())return;
    dispose();dispose=()=>{};
    if(activeLayer){map.removeLayer(activeLayer);activeLayer=null;}
    if(index===0){startRaster();return;}
    if(index===1){
      onStatus('Stiamo caricando una mappa alternativa…');
      let cancelled=false;
      const timer=setTimeout(()=>failover.fail(1),15000);
      dispose=()=>{cancelled=true;clearTimeout(timer);};
      import('./basemap-vector').then(({openVectorBasemap})=>{
        if(cancelled)return;
        const layer=openVectorBasemap(map);
        activeLayer=layer;
        const vector=layer.getMaplibreMap();
        const error=()=>failover.fail(1);
        vector.on('error',error);
        vector.once('load',()=>{
          if(cancelled)return;
          clearTimeout(timer);onStatus('La mappa alternativa OpenFreeMap è disponibile.');
        });
        dispose=()=>{cancelled=true;clearTimeout(timer);vector.off('error',error);};
      }).catch(()=>{if(!cancelled)failover.fail(1);});
      return;
    }
    onStatus('Le mappe online non sono disponibili. Mostriamo uno schema di Milano per aiutarti a individuare le sedi.');
    activeLayer=openLocalBasemap(L,map);
  }
  function startRaster() {
    const pending=new Map<HTMLCanvasElement,AbortController>();
    let removed=false;
    const Layer=L.TileLayer.extend({
      createTile(coords:any,done:(error:unknown,tile:HTMLCanvasElement)=>void) {
        const tile=document.createElement('canvas');tile.width=256;tile.height=256;
        const controller=new AbortController();pending.set(tile,controller);
        const timer=setTimeout(()=>controller.abort('timeout'),8000);
        (async()=>{
          let image:ImageBitmap|undefined;
          try {
            const response=await fetch(this.getTileUrl(coords),{signal:controller.signal,referrerPolicy:'origin',credentials:'omit'});
            image=await createImageBitmap(await checkedTileBlob(response));
            if(removed)return;
            controller.signal.throwIfAborted();
            // Decode off-screen: error images never enter the visible map.
            const scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;
            const check=scratch.getContext('2d',{willReadFrequently:true});
            if(!check)throw new Error('Canvas non disponibile');
            check.drawImage(image,0,0);
            if(isBlockedTilePixels(check.getImageData(0,0,image.width,image.height).data,image.width,image.height))throw new Error('Cartografia bloccata');
            const context=tile.getContext('2d');if(!context)throw new Error('Canvas non disponibile');
            context.drawImage(image,0,0,256,256);
            done(null,tile);
          } catch(error) {
            if(!removed && (!controller.signal.aborted || controller.signal.reason==='timeout')){
              done(error,tile);failover.fail(0);
            }
          } finally {clearTimeout(timer);pending.delete(tile);image?.close();}
        })();
        return tile;
      },
    });
    activeLayer=new Layer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      keepBuffer:1,
    });
    activeLayer.on('tileunload',({tile}:any)=>{pending.get(tile)?.abort();pending.delete(tile);});
    dispose=()=>{removed=true;for(const controller of pending.values())controller.abort();pending.clear();};
    activeLayer.addTo(map);
  }
  const privacyChange=()=>{
    if(mapsAllowed()) activate(0);
    else {
      activate(2);
      onStatus('Mappa schematica locale. Per la cartografia online, abilita le mappe esterne nelle preferenze privacy nel footer.');
    }
  };
  privacyChange();
  window.addEventListener('privacy:change',privacyChange);
  map.once('unload',()=>{destroyed=true;dispose();window.removeEventListener('privacy:change',privacyChange);});
}
