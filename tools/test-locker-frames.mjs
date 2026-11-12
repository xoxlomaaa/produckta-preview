import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {framePacks} from '../src/showcase/locker/config/frame-packs.mjs';
import {frameSource} from '../src/showcase/locker/src/js/render-story/frame-source.js';
import {framePool} from '../src/showcase/locker/src/js/render-story/frames.js';
let requests = 0;
const priorities = [];
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    requests++;
    priorities.push(options.priority);
    return new Response(await readFile(new URL('../assets'+url, import.meta.url)));
  };
  for (const pack of framePacks) {
    const source = frameSource(pack.entries.map(([url]) => url));
    const owner = new AbortController();
    const bytes = await readFile(new URL('../assets'+pack.url, import.meta.url));
    assert.equal(bytes.length, pack.entries.reduce((sum, [, size]) => sum + size, 0));
    let offset = 0;
    const before = requests;
    for (const [url, size, width, height] of pack.entries) {
      assert(width>0 && height>0);
      assert.equal(source.dimensions(url).width, width);
      assert.equal(source.dimensions(url).height, height);
      const blob = await source.get(url+'?v=2', owner.signal);
      const buffer = Buffer.from(await blob.arrayBuffer());
      assert.equal(buffer.length, size);
      assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
      assert.deepEqual(buffer, bytes.subarray(offset, offset + size));
      offset += size;
    }
    assert.equal(requests - before, 1, 'A pack must be downloaded only once, including reverse reads');
    await source.get(pack.entries[0][0], owner.signal);
    assert.equal(requests - before, 1);
    owner.abort();
    await assert.rejects(source.get(pack.entries[0][0], owner.signal), {name:'AbortError'});
    source.destroy();
  }
  const first = framePacks[0].entries[0][0];
  const second = framePacks[1].entries[0][0];
  const promoted = frameSource([first, second]);
  const priorityOwner = new AbortController();
  await promoted.get(first, priorityOwner.signal);
  promoted.prioritize();
  await promoted.get(second, priorityOwner.signal);
  assert.deepEqual(priorities.slice(-2), ['low', 'auto'], 'Visible frames must leave the background priority');
  promoted.destroy();
  const source = frameSource([first]);
  let fallback = false;
  globalThis.fetch = async url => {
    if (url.endsWith('.bin')) return new Response('', {status:503});
    fallback = true; return new Response(new Blob(['fallback']));
  };
  assert.equal(await (await source.get(first, new AbortController().signal)).text(), 'fallback');
  assert(fallback);source.destroy();
  let decode, closed = 0;
  globalThis.createImageBitmap = () => new Promise(resolve => {decode = () => resolve({close(){closed++;}});});
  const pool = framePool({concurrency:2, capacity:4, changed(){}, load:async()=>new Blob()});
  pool.update(['frame'], new Set(['frame']), ['frame']);
  await new Promise(resolve => setTimeout(resolve, 0));
  pool.clear();decode();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(pool.get('frame'), undefined);
  assert.equal(closed, 1, 'A late bitmap after cancellation must be freed');
  console.log(`Validated ${framePacks.length} packs, byte boundaries, one fetch, fallback and cancellation.`);
} finally {globalThis.fetch = originalFetch;}
