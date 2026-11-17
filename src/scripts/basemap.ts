import { mapsAllowed } from '../lib/consent';
import { BasemapFailover, checkedTileBlob, isBlockedTilePixels } from '../lib/map-health';
import { openLocalBasemap } from './basemap-local';

export type BasemapState={phase:'loading'|'ready'|'fallback'|'local';message:string;refresh?:boolean};
export function installBasemap(L:any,map:any,onStatus:(message:string)=>void,onState?:(state:BasemapState)=>void) {
  let activeLayer:any=null;
  let destroyed=false;
  let phase:BasemapState['phase']='loading';
  function notify(next:BasemapState['phase'],message:string,refresh=false){phase=next;onStatus(message);onState?.({phase:next,message,refresh});}
  let dispose=()=>{};
  const failover=new BasemapFailover((index,generation)=>activate(index,generation));
  function activate(index:number,generation=failover.generation) {
    if(destroyed)return;
    if(index < 2 && !mapsAllowed())return;
    dispose();dispose=()=>{};
    if(activeLayer){map.removeLayer(activeLayer);activeLayer=null;}
    if(index===0){startRaster(generation);return;}
    if(index===1){
      notify('loading','Stiamo caricando una mappa alternativa…');
      let cancelled=false;
      const timer=setTimeout(()=>{if(!cancelled)failover.fail(1,generation);},15000);
      dispose=()=>{cancelled=true;clearTimeout(timer);};
      import('./basemap-vector').then(({openVectorBasemap})=>{
        if(cancelled)return;
        const layer=openVectorBasemap(map);
        activeLayer=layer;
        const vector=layer.getMaplibreMap();
        const error=()=>{if(!cancelled)failover.fail(1,generation);};
        vector.on('error',error);
        vector.once('load',()=>{
          if(cancelled)return;
          clearTimeout(timer);notify('ready','La mappa alternativa OpenFreeMap è disponibile.');
        });
        dispose=()=>{cancelled=true;clearTimeout(timer);vector.off('error',error);};
      }).catch(()=>{if(!cancelled)failover.fail(1,generation);});
      return;
    }
    if(mapsAllowed())notify('fallback','Le mappe online non sono disponibili. Mostriamo uno schema locale: i punti delle sedi restano disponibili, ma mancano le strade e i dettagli fuori Milano.');
    else notify('local','Mappe esterne disattivate: lo schema locale mostra solo i quartieri di Milano e alcune linee indicative. Puoi scegliere la cartografia stradale dalle preferenze delle mappe.');
    activeLayer=openLocalBasemap(L,map);
  }
  function startRaster(generation:number) {
    notify('loading','Stiamo caricando la cartografia. Le sedi restano disponibili.');
    const pending=new Map<HTMLCanvasElement,AbortController>();
    let removed=false;
    let loaded=false;
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
              done(error,tile);failover.fail(0,generation);
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
    activeLayer.on('loading',()=>{if(!removed&&generation===failover.generation&&failover.current===0)notify('loading','Stiamo caricando la cartografia. Le sedi restano disponibili.',loaded);});
    activeLayer.on('load',()=>{if(!removed&&generation===failover.generation&&failover.current===0){loaded=true;notify('ready','');}});
    dispose=()=>{removed=true;for(const controller of pending.values())controller.abort();pending.clear();};
    activeLayer.addTo(map);
  }
  const privacyChange=()=>{
    if(mapsAllowed()) failover.restart();
    else {
      activate(2);
    }
  };
  privacyChange();
  window.addEventListener('privacy:change',privacyChange);
  map.once('unload',()=>{destroyed=true;dispose();window.removeEventListener('privacy:change',privacyChange);});
  return {retry(){if(!destroyed&&phase!=='loading')privacyChange();}};
}
