import test from 'node:test';
import assert from 'node:assert/strict';
import {BasemapFailover,checkedTileBlob,isBlockedTilePixels} from '../src/lib/map-health.ts';
test('switches once per provider and ignores stale errors without loops',()=>{
  const changes:number[]=[];const fallback=new BasemapFailover(index=>changes.push(index));
  assert.equal(fallback.fail(0),true);assert.equal(fallback.current,1);
  assert.equal(fallback.fail(0),false);assert.deepEqual(changes,[1]);
  assert.equal(fallback.fail(1),true);assert.equal(fallback.current,2);
  assert.equal(fallback.fail(1),false);assert.equal(fallback.fail(2),false);
  assert.deepEqual(changes,[1,2]);
});
test('rejects HTTP errors and error tiles signalled with HTTP 200 plus x-blocked',async()=>{
  await assert.rejects(checkedTileBlob(new Response('',{status:403})));
  await assert.rejects(checkedTileBlob(new Response('png',{headers:{'content-type':'image/png','x-blocked':'policy'}})));
  await assert.rejects(checkedTileBlob(new Response('<html>Error</html>',{headers:{'content-type':'text/html'}})));
  assert.equal((await checkedTileBlob(new Response('png',{headers:{'content-type':'image/png'}}))).size,3);
});
test('recognizes the warning image even when the status and exposed headers look successful',()=>{
  const width=256,height=256,pixels=new Uint8ClampedArray(width*height*4).fill(255);
  assert.equal(isBlockedTilePixels(pixels,width,height),false);
  for(let y=0;y<height;y++)for(let x=0;x<18;x++){
    const i=(y*width+x)*4;const yellow=Math.floor((y+x)/14)%2===0;
    pixels[i]=yellow?245:20;pixels[i+1]=yellow?240:20;pixels[i+2]=yellow?70:20;
  }
  assert.equal(isBlockedTilePixels(pixels,width,height),true);
  // Ordinary colored roads, without a warning border, remain visible.
  pixels.fill(190);assert.equal(isBlockedTilePixels(pixels,width,height),false);
  assert.equal(isBlockedTilePixels(new Uint8ClampedArray(0),width,height),false);
});
