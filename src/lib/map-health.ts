/** Detect OSM's HTTP-200 warning tiles (black/yellow border on a white notice). */
export function isBlockedTilePixels(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  if(width<32 || height<32 || pixels.length<width*height*4)return false;
  let yellow=0,black=0,edge=0,white=0,total=0;
  for(let y=2;y<height;y+=4) for(let x=2;x<Math.ceil(width*.08);x+=3){
    const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];edge++;
    if(r>175 && g>165 && b<150 && Math.abs(r-g)<65)yellow++;
    if(r<65 && g<65 && b<65)black++;
  }
  for(let y=4;y<height;y+=12)for(let x=4;x<width;x+=12){
    const i=(y*width+x)*4;total++;
    if(pixels[i]>225 && pixels[i+1]>225 && pixels[i+2]>225)white++;
  }
  return yellow/edge>.18 && black/edge>.18 && white/total>.45;
}
export async function checkedTileBlob(response: Response): Promise<Blob> {
  // Some OSM blocks return 200 plus x-blocked; pixel validation covers CORS-hidden headers.
  if(!response.ok || response.headers.has('x-blocked'))throw new Error('Cartografia non disponibile');
  if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Risposta cartografica non valida');
  return response.blob();
}

/** Monotonic failover: stale errors never switch a newer provider or cause retry loops. */
export class BasemapFailover {
  current=0;
  generation=0;
  private change: (index:number,generation:number)=>void;
  constructor(change:(index:number,generation:number)=>void){this.change=change;}
  restart(){this.generation++;this.current=0;this.change(0,this.generation);}
  fail(provider:number,generation=this.generation) {
    if(generation!==this.generation || provider!==this.current || this.current>=2)return false;
    this.current++;
    this.change(this.current,this.generation);
    return true;
  }
}
