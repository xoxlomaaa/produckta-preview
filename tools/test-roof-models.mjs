import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseGlb,viewBytes} from './prepare-roof-models.mjs';
import {roofAssets} from '../src/showcase/roof-assets.js';
import {downloadRoof} from '../src/showcase/roof-download.js';
const original=parseGlb(await readFile('assets/showcase/construction/models/roof.glb'));
const imageViews=new Set(original.json.images.map(image=>image.bufferView));
for(const [profile,asset] of Object.entries(roofAssets)){
  const buffer=await readFile('assets'+asset.url),model=parseGlb(buffer);
  assert.equal(buffer.length,asset.bytes);assert(buffer.length<9675016);
  for(const key of ['nodes','meshes','scenes','scene','accessors','materials','samplers','asset'])assert.deepEqual(model.json[key],original.json[key],`${profile}: ${key} changed`);
  assert.equal(model.json.bufferViews.length,original.json.bufferViews.length);
  for(let index=0;index<original.json.bufferViews.length;index++){
    if(!imageViews.has(index))assert.deepEqual(viewBytes(model,index),viewBytes(original,index),`${profile}: geometry buffer ${index} changed`);
    assert.equal(model.json.bufferViews[index].byteOffset%4,0);
  }
  assert.equal(model.json.images.length,9);
  for(const [index,image] of model.json.images.entries()){
    assert.equal(image.name,original.json.images[index].name);
    const bytes=viewBytes(model,image.bufferView);
    if(image.mimeType==='image/webp')assert.equal(bytes.toString('ascii',8,12),'WEBP');
    else assert.deepEqual(bytes,viewBytes(original,image.bufferView));
  }
  for(const extension of original.json.extensionsRequired)assert(model.json.extensionsRequired.includes(extension));
  assert(model.json.extensionsRequired.includes('EXT_texture_webp'));
  for(const [index,texture] of model.json.textures.entries()){
    const source=texture.extensions?.EXT_texture_webp?.source??texture.source;
    assert.equal(source,original.json.textures[index].source,'Material points at the wrong image');
  }
}
console.log('Both roof profiles preserve every geometry buffer, hierarchy, material, layer metadata and texture reference.');
const originalFetch=globalThis.fetch;
try {
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2]));controller.enqueue(new Uint8Array([3,4,5]));controller.close();}}));
  const progress=[];
  const bytes=await downloadRoof('/model.glb',5,value=>progress.push(value),new AbortController().signal);
  assert.deepEqual([...bytes],[1,2,3,4,5]);assert(Math.abs(progress[0]-.36)<1e-12);assert.equal(progress[1],.9);
  const owner=new AbortController();owner.abort();
  await assert.rejects(downloadRoof('/model.glb',5,()=>{},owner.signal),{name:'AbortError'});
  globalThis.fetch=async()=>new Response('',{status:503});
  await assert.rejects(downloadRoof('/model.glb',5,()=>{},new AbortController().signal),/HTTP 503/);
  console.log('Streaming download preserves bytes, reports progress, propagates HTTP errors and aborts.');
}finally{globalThis.fetch=originalFetch;}
