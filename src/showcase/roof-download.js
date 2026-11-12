export async function downloadRoof(url, expectedBytes, onProgress, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error('Не удалось загрузить файл модели (HTTP '+response.status+').');
  const total = expectedBytes || Number(response.headers.get('content-length')) || 1;
  const reader = response.body.getReader(), chunks = [];
  let loaded = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value);loaded += value.length;
      onProgress(Math.min(.9, loaded / total * .9));
    }
  } finally { reader.releaseLock(); }
  signal?.throwIfAborted();
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.length;}
  chunks.length = 0;
  return bytes;
}
