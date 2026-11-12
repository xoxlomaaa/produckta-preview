// One wheel stream owns the page and an optional same-origin preview. Keeping
// velocity here avoids a second easing animation when crossing the iframe edge.
const nativeTargets = 'input, textarea, select, dialog, [popover], [data-native-scroll], [contenteditable]:not([contenteditable="false"])';
const referenceStep = 315;
const frequency = 0.020;
const sceneFrequency = 0.014;
let instance;

export function wheelPixels(event) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return 0;
  return event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
}

export function canScrollInside(target, boundary, delta) {
  for (let el = target?.nodeType === 1 ? target : target?.parentElement; el && el !== boundary; el = el.parentElement) {
    if (!/^(auto|scroll|overlay)$/.test(getComputedStyle(el).overflowY)) continue;
    const max = el.scrollHeight - el.clientHeight;
    if (max > 1 && (delta > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1)) return true;
  }
  return false;
}

// Keep the original render-story's wheel distance through its registered scenes.
function destination(from, delta, ranges) {
  if (!delta) return from;
  const direction = Math.sign(delta);
  const spans = ranges.map(([start, end, steps]) => ({
    start: direction * (direction > 0 ? start : end),
    end: direction * (direction > 0 ? end : start),
    gain: Math.min(1, (end - start) / (steps * referenceStep)),
  })).sort((a, b) => a.start - b.start);
  let point = from * direction;
  let remaining = Math.abs(delta);
  for (const {start, end, gain} of spans) {
    if (end <= point || gain <= 0) continue;
    const distance = Math.max(0, start - point);
    if (remaining <= distance) break;
    point += distance;
    remaining -= distance;
    const used = Math.min(remaining, (end - point) / gain);
    point += used * gain;
    remaining -= used;
  }
  return (point + remaining) * direction;
}

function spring(remaining, velocity, dt, rate) {
  const decay = Math.exp(-rate * dt);
  const coefficient = rate * remaining - velocity;
  return {
    remaining: (remaining + coefficient * dt) * decay,
    velocity: (velocity + rate * coefficient * dt) * decay,
  };
}

export function initSmoothScroll() {
  if (instance) return instance;
  const lifetime = new AbortController();
  const {signal} = lifetime;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const staticView = /^(reduce|still)$/.test(new URLSearchParams(location.search).get('motion') || new URLSearchParams(location.search).get('view') || '');
  const readers = new Set();
  const previews = new Set();
  let frame = 0, remaining = 0, velocity = 0, lastTime = 0;
  let responseFrequency = frequency;
  let pagePosition = scrollY, pageWrite = scrollY, child = null;
  let lastWheel = -Infinity, direction = 0, precision = false;

  function cancel() {
    cancelAnimationFrame(frame);
    frame = 0;
    remaining = velocity = 0;
    pagePosition = pageWrite = scrollY;
    child = null;
  }

  function limit(view) {
    try {
      const page = view.document.scrollingElement;
      return page ? Math.max(0, page.scrollHeight - page.clientHeight) : 0;
    } catch { return 0; }
  }

  function clamp(value, max) { return Math.max(0, Math.min(max, value)); }

  function unchanged() {
    try { return scrollY === pageWrite && (!child || child.view.scrollY === child.write); }
    catch { return false; } // A failed iframe navigation can become opaque.
  }

  function previewFor(sign) {
    return [...previews].map(read => ({...read(), read}))
      .filter(item => item.view && Number.isFinite(item.alignAt) && (item.alignAt - scrollY) * sign >= -1)
      .sort((a, b) => (a.alignAt - b.alignAt) * sign)[0];
  }

  // Route input through approach -> centred preview -> departure, in either
  // direction. Projecting the pending queue uses this same path as painting it.
  function route(from, delta, inner = child?.position) {
    let page = from;
    let nested = inner;
    let rest = delta;
    if (child) {
      const anchor = child.alignAt;
      // Browsers round window.scrollY to whole pixels; don't treat a fraction
      // beyond the anchor as leaving the preview when the wheel reverses.
      if (anchor !== null && Math.abs(page - anchor) <= 1) page = anchor;
      if (anchor !== null && rest * (anchor - page) > 0) {
        const approach = Math.sign(rest) * Math.min(Math.abs(rest), Math.abs(anchor - page));
        page += approach;
        rest -= approach;
      }
      if (anchor === null || Math.abs(page - anchor) < 0.01) {
        // Reserve the centre while the same-origin document is loading. Keep
        // unconsumed input for the readiness event instead of skipping ahead.
        if (!child.ready) return {page: child.bypassLoading ? clamp(page + rest, limit(window)) : page, nested};
        const next = clamp(nested + rest, limit(child.view));
        rest -= next - nested;
        nested = next;
      }
    }
    return {page: clamp(page + rest, limit(window)), nested};
  }

  function apply(delta) {
    const next = route(pagePosition, delta);
    const used = next.page - pagePosition + (child ? next.nested - child.position : 0);
    if (child && next.nested !== child.position) {
      child.position = next.nested;
      child.view.scrollTo({top: next.nested, behavior: 'instant'});
      child.write = child.view.scrollY;
    }
    if (next.page !== pagePosition) {
      pagePosition = next.page;
      window.scrollTo({top: next.page, behavior: 'instant'});
      pageWrite = scrollY;
    }
    return used;
  }

  function queuedDistance(delta, ranges) {
    if (child && !child.ready) return delta;
    const pending = route(pagePosition, remaining);
    const next = route(pending.page, delta, pending.nested);
    const childDistance = child ? next.nested - pending.nested : 0;
    const rootTarget = destination(pending.page, next.page - pending.page, ranges);
    return childDistance + clamp(rootTarget, limit(window)) - pending.page;
  }

  function advance(time) {
    frame = 0;
    if (!unchanged()) { cancel(); return; }
    // Bound catch-up after a dropped frame instead of jumping over the scene.
    const dt = Math.max(0, Math.min(40, time - lastTime));
    lastTime = time;
    if (!dt) { frame = requestAnimationFrame(advance); return; }
    const next = spring(remaining, velocity, dt, responseFrequency);
    const delta = remaining - next.remaining;
    remaining = next.remaining;
    velocity = next.velocity;
    const used = apply(delta);
    if (child && !child.ready && !child.bypassLoading && Math.abs(pagePosition - child.alignAt) <= 1) {
      remaining += delta - used;
      velocity = 0;
      return; // Readiness wakes the queue; no empty animation/polling loop.
    }
    if (!used) { cancel(); return; }
    if (Math.abs(remaining) < 0.08 && Math.abs(velocity) < 0.002) {
      apply(remaining);
      remaining = velocity = 0;
      child = null;
    } else frame = requestAnimationFrame(advance);
  }

  function scrollBy(delta, {nested = null, deltaMode = 0, alignAt = null} = {}) {
    if (!Number.isFinite(delta) || !delta || document.hidden) return false;
    const now = performance.now();
    const sign = Math.sign(delta), interval = now - lastWheel;
    const leavingLoading = child && !child.ready && (child.bypassLoading || sign !== direction)
      && Math.abs(pagePosition - child.alignAt) <= 1;
    if (interval > 150 || sign !== direction) precision = false;
    if (deltaMode === 0 && Math.abs(delta) < 32) precision = true;
    lastWheel = now;
    direction = sign;
    if (!unchanged() || (remaining && Math.sign(remaining) !== sign)) cancel();
    const preview = nested
      ? [...previews].map(read => ({...read(), read})).find(item => item.view === nested)
      : previewFor(sign);
    if (preview) {
      nested = preview.view;
      alignAt = preview.alignAt;
    }
    if (nested && !preview) {
      try { if (nested.location.origin !== location.origin) return false; }
      catch { return false; }
    }
    if (child?.view !== (nested || undefined)) {
      // As the page moves, a stationary cursor may leave the iframe. Retain
      // its pending distance and velocity once the child has reached its edge.
      const atEdge = child && (sign > 0 ? child.position >= limit(child.view) - 0.1 : child.position <= 0.1);
      const enteringEdge = !child && nested && (sign > 0 ? nested.scrollY >= limit(nested) - 0.1 : nested.scrollY <= 0.1);
      if (!atEdge && !enteringEdge) cancel();
      else child = null;
    }
    if (!nested && (precision || preference.matches || staticView)) { cancel(); return false; }
    if (nested && !child) {
      child = {view: nested, position: nested.scrollY, write: nested.scrollY, alignAt: null, ready: true, reader: null, bypassLoading: Boolean(leavingLoading)};
    }
    if (child && nested) child.alignAt = Number.isFinite(alignAt) ? clamp(alignAt, limit(window)) : null;
    if (child && preview) {
      child.ready = preview.ready;
      child.reader = preview.read;
    }
    if (preference.matches || staticView || precision) {
      // Trackpads already supply continuous movement and momentum. In the
      // iframe only route their pixels; never add a second inertia curve.
      const input = delta + (!frame && child && !child.ready ? remaining : 0);
      remaining = velocity = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      const used = apply(input);
      if (child && !child.ready) remaining = input - used;
      else child = null;
      return true;
    }
    // Convert only the NEW input into scene distance. Reweighting the entire
    // pending queue every frame made a fast third notch accelerate old motion.
    // Normal wheel notches retain the scene pace even when events arrive fast.
    // Only explicit page-sized input bypasses it; timing must not change gain.
    const fast = deltaMode === 2 || Math.abs(delta) >= referenceStep * 2;
    const distance = queuedDistance(delta, fast ? [] : [...readers].flatMap(read => read()));
    const idle = !frame;
    const paced = Math.abs(distance - delta) > 0.1;
    if (idle) responseFrequency = paced ? sceneFrequency : frequency;
    else if (paced) responseFrequency = Math.min(responseFrequency, sceneFrequency);
    remaining = clamp(Math.abs(remaining + distance), innerHeight * 4) * sign;
    if (!frame) {
      // A modest initial velocity responds on the first frame; subsequent input
      // retains the current velocity rather than restarting the easing curve.
      velocity = remaining * responseFrequency * 0.25;
      lastTime = now;
      frame = requestAnimationFrame(advance);
    }
    return true;
  }

  function refreshPreviews() {
    if (signal.aborted || !child?.reader) return;
    const current = child.reader();
    if (!current?.view || !previews.has(child.reader)) child = null;
    else {
      child.ready = current.ready;
      child.alignAt = clamp(current.alignAt, limit(window));
    }
    if (!remaining || frame || (child && !child.ready)) return;
    if (!unchanged()) { cancel(); return; }
    if (preference.matches || staticView || precision) {
      apply(remaining);
      remaining = velocity = 0;
      child = null;
    } else {
      lastTime = performance.now();
      frame = requestAnimationFrame(advance);
    }
  }

  function wheel(event) {
    const delta = wheelPixels(event);
    if (!delta || !event.cancelable || event.defaultPrevented || event.target.closest?.(nativeTargets) || document.querySelector('dialog:modal') || canScrollInside(event.target, document.scrollingElement, delta)) {
      cancel(); return;
    }
    if (scrollBy(delta, {deltaMode: event.deltaMode})) event.preventDefault();
  }

  window.addEventListener('wheel', wheel, {passive: false, signal});
  for (const name of ['keydown', 'pointerdown', 'touchstart', 'resize', 'hashchange', 'popstate']) {
    window.addEventListener(name, cancel, {passive: true, signal});
  }
  document.addEventListener('visibilitychange', cancel, {signal});
  preference.addEventListener('change', cancel, {signal});
  const api = {
    scrollBy, cancel, refreshPreviews,
    registerPreview(read, owner) {
      if (owner.aborted) return;
      previews.add(read);
      owner.addEventListener('abort', () => { previews.delete(read); refreshPreviews(); }, {once: true});
    },
    registerRanges(read, owner) {
      readers.add(read);
      owner.addEventListener('abort', () => readers.delete(read), {once: true});
    },
    get moving() { return Boolean(frame); },
    positionAt(time) {
      if (!frame) return scrollY;
      const delta = remaining - spring(remaining, velocity, Math.max(0, time - lastTime), responseFrequency).remaining;
      return route(pagePosition, delta).page;
    },
    destroy() { cancel(); readers.clear(); previews.clear(); lifetime.abort(); instance = undefined; },
  };
  window.addEventListener('pagehide', event => {
    if (event.persisted) cancel();
    else api.destroy();
  }, {signal});
  instance = api;
  return api;
}
