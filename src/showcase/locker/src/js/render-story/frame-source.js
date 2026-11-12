import {framePacks} from '../../../config/frame-packs.mjs';

// Compressed frames stay resident; only the small moving bitmap window is decoded.
export function frameSource(urls, {priority = 'low'} = {}) {
  const wanted = new Set(urls.map(url => url.split('?')[0]));
  const lookup = new Map(), requests = new Map();
  const lifetime = new AbortController();
  const firstFrame = pack => Number(pack.entries.find(([url]) => wanted.has(url))[0].match(/\/(\d+)\.webp$/)[1]);
  const packs = framePacks.filter(pack => pack.entries.some(([url]) => wanted.has(url)))
    .sort((a, b) => firstFrame(a) - firstFrame(b));
  for (const pack of packs) {
    let offset = 0;
    for (const [url, size, width, height] of pack.entries) {
      if (wanted.has(url)) lookup.set(url, {pack, offset, size, width, height});
      offset += size;
    }
  }
  function fetchPack(pack) {
    if (!requests.has(pack.url)) {
      requests.set(pack.url, fetch(pack.url, {signal:lifetime.signal, priority})
        .then(response => {
          if (!response.ok) throw new Error(`Frame pack returned ${response.status}`);
          return response.blob();
        }).catch(error => { requests.delete(pack.url); throw error; }));
    }
    return requests.get(pack.url);
  }
  async function get(url, signal) {
    const entry = lookup.get(url.split('?')[0]);
    if (entry) {
      try {
        const blob = await fetchPack(entry.pack);
        signal.throwIfAborted();
        return blob.slice(entry.offset, entry.offset + entry.size, 'image/webp');
      } catch (error) {
        if (signal.aborted || lifetime.signal.aborted) throw error;
        // Individual, already published frames keep the scene usable on a pack failure.
      }
    }
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error(`Frame request returned ${response.status}`);
    return response.blob();
  }
  async function prepare() {
    let index = 0;
    await Promise.all([0, 1].map(async () => {
      while (index < packs.length && !lifetime.signal.aborted) {
        const pack = packs[index++];
        try { await fetchPack(pack); } catch { /* Visible frames retry on demand. */ }
      }
    }));
    return !lifetime.signal.aborted && packs.every(pack => requests.has(pack.url));
  }
  return {get, prepare, prioritize() { priority = 'auto'; }, dimensions:url => lookup.get(url.split('?')[0]), destroy() { lifetime.abort(); requests.clear(); }};
}
