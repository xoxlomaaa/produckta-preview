import { motionPreference, staticView } from '../../compat/runtime/scripts/motion.js';

const swayDistance = 50;
const swayPeriod = 28;

import { startCloudWorker } from './cloud-worker-client.js';

export async function initSkyClouds() {
  const sky = document.querySelector('[data-sky-panel]');
  let canvas = sky.querySelector('.flight-cloud-field');
  const layer = canvas.parentElement;
  const showFallback = () => {
    delete layer.dataset.rendered;
    layer.dataset.fallback = '';
  };
  if (staticView) {
    showFallback();
    return;
  }

  function onPaint() {
    if (!layer.hasAttribute('data-rendered')) layer.dataset.rendered = '';
  }
  function onFailure() {
    showFallback();
    destroy();
  }

  let renderer;
  if (
    canvas.dataset.cloudWorker &&
    typeof Worker === 'function' &&
    canvas.transferControlToOffscreen
  ) {
    try {
      renderer = await startCloudWorker(canvas, onPaint, onFailure);
    } catch {
      // A transferred canvas cannot create its own context when the worker is unavailable.
      const replacement = canvas.cloneNode();
      canvas.replaceWith(replacement);
      canvas = replacement;
    }
  }
  canvas.dataset.cloudBackend = renderer ? 'worker' : 'main';
  if (!renderer) {
    try {
      const { createCloudRenderer } = await import('./sky-cloud-renderer.js');
      renderer = await createCloudRenderer(canvas);
    } catch {
      showFallback();
      return;
    }
  }

  const lifetime = new AbortController();
  const { signal } = lifetime;
  let visible = true;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let strength = 0;
  let targetStrength = 0;
  let width = 0;
  let height = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }

  function sync() {
    if (!visible || document.hidden || signal.aborted) stop();
    else if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    const reduced = motionPreference.matches;
    const delta = previous && !reduced ? Math.min((now - previous) / 1000, 0.065) : 0;
    previous = now;
    elapsed += delta;
    const ease = 1 - Math.exp(-delta * 1.9);
    x += (targetX - x) * ease;
    y += (targetY - y) * ease;
    strength += (targetStrength - strength) * ease;
    const seconds = reduced ? 0 : elapsed;
    if (width && height) {
      renderer.paint({
        width,
        height,
        seconds,
        offset: swayDistance * Math.sin((seconds / swayPeriod) * Math.PI * 2),
        x,
        y,
        strength: reduced ? 0 : strength,
      });
      if (canvas.dataset.cloudBackend === 'main') onPaint();
    }
    if (!reduced) sync();
  }

  const size = new ResizeObserver(([entry]) => {
    ({ width, height } = entry.contentRect);
    if (!width || !height) return;
    stop();
    sync();
  });
  size.observe(layer);
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  view.observe(sky);
  sky.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || motionPreference.matches) return;
      const bounds = sky.getBoundingClientRect();
      targetX = (event.clientX - bounds.left) / bounds.width;
      targetY = (event.clientY - bounds.top) / bounds.height;
      if (strength < 0.04) {
        x = targetX;
        y = targetY;
      }
      targetStrength = 1;
    },
    { passive: true, signal },
  );
  sky.addEventListener(
    'pointerleave',
    () => {
      targetStrength = 0;
    },
    { signal },
  );
  document.addEventListener('visibilitychange', sync, { signal });
  motionPreference.addEventListener('change', sync);

  function destroy() {
    stop();
    renderer.destroy?.();
    size.disconnect();
    view.disconnect();
    motionPreference.removeEventListener('change', sync);
    lifetime.abort();
  }
  canvas.addEventListener('webglcontextlost', onFailure, { once: true, signal });
  window.addEventListener(
    'pagehide',
    (event) => {
      if (event.persisted) stop();
      else destroy();
    },
    { signal },
  );
  window.addEventListener('pageshow', sync, { signal });
}
