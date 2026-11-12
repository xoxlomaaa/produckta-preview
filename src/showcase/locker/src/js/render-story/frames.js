export function framePool({ concurrency, capacity, changed }) {
  const decoded = new Map();
  const pending = new Map();
  const failed = new Set();

  function request(url) {
    const controller = new AbortController();
    pending.set(url, controller);
    (async () => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Frame request returned ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob());
      if (controller.signal.aborted) {
        bitmap.close();
        return;
      }
      decoded.set(url, bitmap);
    })()
      .catch(() => {
        if (!controller.signal.aborted) failed.add(url);
      })
      .finally(() => {
        if (pending.get(url) !== controller) return;
        pending.delete(url);
        changed();
      });
  }

  function update(ordered, nearby, critical = []) {
    // A target changes on every wheel frame. Finish short in-flight decodes
    // instead of repeatedly cancelling useful work and starving playback.
    const missing = critical.filter(
      (url) => !decoded.has(url) && !pending.has(url) && !failed.has(url),
    );
    let available =
      concurrency - [...pending.values()].filter((item) => !item.signal.aborted).length;
    // The next visible pair gets the slots. Keep an aborted
    // request counted until its download or decode has actually settled.
    for (const [url, controller] of pending) {
      if (available >= missing.length) break;
      if (controller.signal.aborted || critical.includes(url) || nearby.has(url)) continue;
      controller.abort();
      available++;
    }
    const preferred = ordered.slice(0, capacity);
    for (const [url, bitmap] of decoded) {
      if (nearby.has(url) && decoded.size <= capacity) continue;
      if (preferred.includes(url)) continue;
      decoded.delete(url);
      bitmap.close();
    }
    const reserve = concurrency > 2 ? 2 : 0;
    // Leave room for the next visible pair instead of letting speculative
    // look-ahead occupy every decoder while playback waits for a frame.
    for (const url of new Set([...critical, ...preferred])) {
      const slots = critical.includes(url) ? concurrency : concurrency - reserve;
      if (pending.size >= slots) continue;
      if (!decoded.has(url) && !pending.has(url) && !failed.has(url)) request(url);
    }
  }

  function clear() {
    for (const controller of pending.values()) controller.abort();
    pending.clear();
    for (const bitmap of decoded.values()) bitmap.close();
    decoded.clear();
    failed.clear();
  }
  return { update, get: (url) => decoded.get(url), unavailable: (url) => failed.has(url), clear };
}
