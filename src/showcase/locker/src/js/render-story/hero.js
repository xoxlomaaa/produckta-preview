import {
  heroLast,
  renderFrame,
  renderProfiles,
  skyLast,
  warehouseFirstMoving,
} from '../../../config/render-media.mjs';
import { mobileSkyFrame } from '../../../config/mobile-sky-media.mjs';
import { tabletSkyFrame, tabletSkyWidth } from '../../../config/tablet-sky-media.mjs';
import { samplePath, smooth } from '../../compat/runtime/scenes/story/story-timeline.js';
import { motionPreference, staticView } from '../../compat/runtime/scripts/motion.js';
import { framePool } from './frames.js';
import { frameSource } from './frame-source.js';
import { skyPose } from './sky-pose.js';

const clampFrame = (frame) => Math.min(heroLast, Math.max(1, frame));
const settleMs = 72;
const wheelPace = 1.15;
const camera = matchMedia('(width < 744px)');
const portraitWarehouse = matchMedia('(width <= 540px)');
const tabletCamera = matchMedia('(744px <= width < 1240px)');
const finePointer = matchMedia('(any-pointer: fine)');
const profileFor = () => {
  if (camera.matches) return 'mobile';
  return tabletCamera.matches ? 'tablet' : 'desktop';
};
const mobileGate = { side: 96, top: 690, bottom: 330 };
// The portrait sky camera tracks and zooms. The warehouse keeps a fixed crop.
// Samples are from the approved mobile v16 camera, before its scale locks at 174.
const portraitZoom = [
  [149, 1.122927],
  [155, 1.155131],
  [160, 1.209761],
  [164, 1.283467],
  [168, 1.369242],
  [172, 1.428428],
  [174, 680 / 470],
];

export function initHeroRender(wheel) {
  const hero = document.querySelector('[data-showcase-locker]');
  const skyPanel = hero.querySelector('[data-sky-panel]');
  const sky = hero.querySelector('[data-flight-viewport]');
  const warehouse = hero.querySelector('[data-warehouse-panel]');
  const poster = warehouse.querySelector('.warehouse-poster');
  const skyCanvas = sky.querySelector('canvas');
  const roomCanvas = warehouse.querySelector('canvas');
  const skyContext = skyCanvas.getContext('2d');
  const roomContext = roomCanvas.getContext('2d', { alpha: false });
  if (!skyContext || !roomContext || typeof createImageBitmap !== 'function') return;
  const pose = skyPose(skyCanvas);

  const lifetime = new AbortController();
  const listen = (target, type, callback, options = {}) =>
    target.addEventListener(type, callback, {
      ...options,
      signal: lifetime.signal,
    });
  let profile = profileFor();
  let pool;
  let source;
  let sourceRoomProfile;
  let primed = false;
  let buffered = false;
  let preparing = false;
  let requested = 0;
  let settleTimer = 0;
  let shown = 0;
  let paintedProfile;
  let paintedRoom;
  let target = 1;
  let direction = 1;
  const initialBounds = hero.getBoundingClientRect();
  let visible = initialBounds.bottom >= -600 && initialBounds.top <= innerHeight + 600;
  let posterFrame = 1;
  let anchors;
  let wheelRanges = [];
  let portraitGap = 0;
  let lastY = scrollY;
  let lastMovement = -Infinity;
  const renderProfile = () => (profile === 'mobile' ? 'mobile' : 'desktop');
  const roomProfile = () => (portraitWarehouse.matches ? 'mobile' : 'desktop');
  const skySize = () => profile === 'desktop' ? [1152, 840] : renderProfiles[renderProfile()].sky;
  const roomSize = () => roomProfile() === 'desktop' ? [1440, 760] : renderProfiles.mobile.warehouse;
  wheel.registerRanges(() => (enabled() && visible ? wheelRanges : []), lifetime.signal);

  function enabled() {
    return !staticView && !motionPreference.matches;
  }

  function request() {
    if (!requested && enabled() && visible && !document.hidden)
      requested = requestAnimationFrame(draw);
  }

  function resetPool() {
    pool?.clear();
    source?.destroy();
    primed = false;
    buffered = preparing = false;
    shown = 0;
    hero.classList.remove('render-hero-ready');
    sourceRoomProfile = roomProfile();
    delete hero.dataset.framesBuffered;
    source = frameSource([...new Set(Array.from({length:heroLast}, (_, i) => frameUrls(i + 1)).flat())].filter(Boolean), {priority:visible ? 'auto' : 'low'});
    warmSource();
    pool = framePool({
      concurrency: profile === 'mobile' ? 4 : 8,
      capacity: profile === 'mobile' ? 24 : 40,
      changed: request,
      load:source.get,
    });
  }

  function warmSource() {
    if (preparing || !enabled()) return;
    // A visitor can jump directly to the roof or a lower anchor. Do not fetch
    // the preceding sequence behind them; a reverse approach wakes it on scroll.
    if (hero.getBoundingClientRect().bottom <= 0) return;
    preparing = true;
    const currentSource = source;
    source.prepare().then(ready => {
      if (source !== currentSource || lifetime.signal.aborted) return;
      buffered = true;
      hero.dataset.framesBuffered = ready ? 'true' : 'fallback';
      request();
    });
  }

  function measure() {
    const skyBox = sky.getBoundingClientRect();
    const skyCard = skyPanel.getBoundingClientRect();
    const room = warehouse.getBoundingClientRect();
    const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const viewport = Math.max(1, innerHeight - header);
    const roomStart = scrollY + room.top;
    // Keep the suitcase in view during the reveal. Move the page farther during
    // the transfer, then settle while the warehouse floor is still on screen.
    const start = Math.max(0, scrollY + skyCard.bottom - skyCard.height * 0.17 - innerHeight + 20);
    const reveal = Math.max(64, Math.min(136, viewport * 0.13));
    const release = start + reveal;
    const handoff = Math.max(release + 48, roomStart - (header + viewport * 0.56));
    const centeredRoom = header + Math.max(0, viewport - room.height) / 2;
    const floorVisible = innerHeight - room.height * 0.94 - 24;
    const roomFocus = Math.min(floorVisible, centeredRoom + Math.min(36, viewport * 0.045));
    const landing = Math.max(handoff + 56, roomStart - roomFocus);
    const finish = landing + Math.max(24, Math.min(64, viewport * 0.065));
    portraitGap = (room.top - skyBox.bottom) / Math.max(1, skyBox.width);
    anchors = [
      [start, 1],
      [start + reveal * 0.16, 10],
      [start + reveal * 0.36, 40],
      [start + reveal * 0.6, 82],
      [start + reveal * 0.8, 110],
      [release, 149],
      [handoff, 174],
      [landing, 209],
      [finish, heroLast],
    ];
    hero.dataset.scrollDistance = anchors.at(-1)[0].toFixed(1);
    hero.dataset.revealDistance = release.toFixed(1);
    wheelRanges = [
      [start, release, 4],
      [release, handoff, 1.15],
      [handoff, landing, 1.4],
      [landing, finish, 2.45],
    ].map(([from, to, steps]) => [from, to, steps * wheelPace]);
    pose.measure();
  }

  function frameUrls(frame) {
    const room = frame < warehouseFirstMoving ? 1 : frame;
    const fallbackProfile = renderProfile();
    const expanded =
      profile === 'mobile'
        ? mobileSkyFrame(frame)
        : profile === 'tablet'
          ? tabletSkyFrame(frame)
          : null;
    return [
      frame <= skyLast ? (expanded?.url ?? renderFrame('sky', fallbackProfile, frame)) : null,
      renderFrame('warehouse', roomProfile(), room),
    ];
  }

  function resizeCanvases() {
    const [width, height] = skySize();
    const { side, top, bottom } = mobileGate;
    skyCanvas.width =
      profile === 'tablet' ? tabletSkyWidth : width + (profile === 'mobile' ? side * 2 : 0);
    skyCanvas.height = height + (profile === 'mobile' ? top + bottom : 0);
    if (profile === 'mobile') {
      const percent = (amount, total) => `${(amount / total) * 100}%`;
      sky.style.setProperty('--sky-canvas-top', percent(-top, height));
      sky.style.setProperty('--sky-canvas-width', percent(skyCanvas.width, width));
      sky.style.setProperty('--sky-canvas-height', percent(skyCanvas.height, height));
      sky.style.setProperty('--sky-canvas-origin', percent(top, skyCanvas.height));
    }
    const [roomWidth, roomHeight] = roomSize();
    if (roomCanvas.width !== roomWidth || roomCanvas.height !== roomHeight) {
      roomCanvas.width = roomWidth;
      roomCanvas.height = roomHeight;
    }
    paintedProfile = profile;
  }

  function paintSky(actor, frame, dimensions) {
    if (profile !== 'mobile') {
      const offset = profile === 'tablet' ? tabletSkyFrame(frame) : null;
      if (profile === 'desktop') {
        skyContext.drawImage(actor, 0, 0, skyCanvas.width, skyCanvas.height);
      } else skyContext.drawImage(actor, offset?.x ?? 0, offset?.y ?? 0);
      return;
    }
    const [width, height] = renderProfiles.mobile.sky;
    const { x = 0, y = 0 } = mobileSkyFrame(frame) ?? {};
    const blend = smooth(140, 160, frame);
    const scale = 1 + blend * (680 / 470 / samplePath(portraitZoom, frame) - 1);
    // Keep the approved projection in the original gate, including across the gap.
    skyContext.drawImage(
      actor,
      mobileGate.side + x * scale + ((1 - scale) * width) / 2 - blend * width * 0.012,
      mobileGate.top +
        y * scale +
        ((1 - scale) * height) / 2 +
        blend * width * (0.151 + portraitGap),
      (dimensions?.width ?? actor.width) * scale,
      (dimensions?.height ?? actor.height) * scale,
    );
  }

  function paint(frame) {
    const [skyUrl, roomUrl] = frameUrls(frame);
    if (frame === shown && paintedProfile === profile && paintedRoom === roomUrl) return true;
    const actor = skyUrl ? pool.get(skyUrl) : null;
    const needsRoom = paintedRoom !== roomUrl;
    const room = needsRoom ? pool.get(roomUrl) : null;
    if ((needsRoom && !room) || (skyUrl && !actor)) return false;
    if (
      paintedProfile !== profile ||
      roomCanvas.width !== roomSize()[0]
    ) {
      resizeCanvases();
    }
    if (actor || shown <= skyLast) skyContext.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
    if (actor) paintSky(actor, frame, source.dimensions(skyUrl));
    if (room) {
      roomContext.drawImage(room, 0, 0, roomCanvas.width, roomCanvas.height);
      paintedRoom = roomUrl;
    }
    shown = frame;
    hero.dataset.renderFrame = String(frame);
    sky.style.setProperty('--hero-approach-offset', (1 - smooth(100, 149, frame)).toFixed(3));
    warehouse.style.setProperty('--warehouse-copy-opacity', smooth(178, 248, frame).toFixed(3));
    hero.classList.add('render-hero-ready');
    return true;
  }

  const frameAt = (y) => Math.round(samplePath(anchors, y));

  function draw(now) {
    requested = 0;
    const smoothing = wheel.moving;
    noteScroll();
    const next = frameAt(scrollY);
    if (next !== target) direction = Math.sign(next - target);
    target = next;
    hero.dataset.renderTarget = String(target);
    // Keep the real poster until the compressed sequence is ready. Scrolling
    // remains available; never start motion that will exhaust its network buffer.
    if (!buffered) { warmSource(); return; }
    if (!primed) {
      const runway = [...new Set(Array.from({length:profile === 'mobile' ? 4 : 8}, (_, i) => frameUrls(clampFrame(target + i * direction))).flat())].filter(Boolean);
      pool.update(runway, new Set(runway), frameUrls(target).filter(Boolean));
      if (!runway.every(url => pool.get(url))) return;
      primed = true;
    }
    const moving = smoothing || performance.now() - lastMovement < settleMs || (shown > 0 && shown !== target);
    // A late decode must not teleport the actor by dozens of source frames.
    // Bridge the gap in short steps, without changing scroll/camera anchors.
    const paintDirection = Math.sign(target - shown) || direction;
    const paintTarget = shown > 0
      ? shown + Math.max(-3, Math.min(3, target - shown))
      : target;
    const beforePaint = shown;
    // Both layers commit the same frame. A nearby decoded frame can keep motion
    // responsive while a new target is in flight.
    if (!paint(paintTarget) && moving) {
      for (let offset = 1; offset <= 12; offset++) {
        const candidate = paintTarget - offset * paintDirection;
        if (candidate < 1 || candidate > heroLast || (candidate - shown) * paintDirection <= 0) continue;
        if (paint(candidate)) break;
      }
    }
    pose.present(Math.max(1, shown), shown === 1 && target === 1 && scrollY <= 1);
    const predicted = smoothing
      ? [24, 52].map((delay) => frameAt(wheel.positionAt(now + delay)))
      : [];
    let offsets;
    if (target !== 1 || shown > 1) {
      offsets = [...Array.from({length: 16}, (_, i) => i + 1), 20, 24, -1, -2, -4]
        .map((offset) => offset * direction);
    } else if (moving || profile !== 'mobile' || finePointer.matches) {
      // Keep the original lead-in buffer for paced wheel input.
      offsets = Array.from({length: 24}, (_, i) => i + 1);
    } else {
      // Paint the opening pose before filling the buffer for the first scroll.
      offsets = shown === 1 ? [1, 3, 6] : [];
    }
    const bridge = shown > 0 && shown !== target
      ? Array.from({length: Math.min(3, Math.abs(target - shown))}, (_, i) => shown + (i + 1) * paintDirection)
      : [];
    // When decoding falls behind, fill the runway after the displayed frame.
    // Prefetching only around a distant scroll target left the bridge empty.
    const bufferHead = shown || target;
    const ahead = [...bridge, paintTarget, target, ...predicted, ...offsets.map((offset) => clampFrame(bufferHead + offset))];
    const ordered = [...new Set(ahead.flatMap(frameUrls))].filter(Boolean);
    const nearby = new Set([
      ...ordered,
      ...Array.from({ length: 25 }, (_, i) => frameUrls(clampFrame(target + i - 12)))
        .flat()
        .filter(Boolean),
    ]);
    const exact = frameUrls(paintTarget).filter(Boolean);
    pool.update(ordered, nearby, exact);
    // Schedule only after actual progress. Missing images wake us through the
    // pool callback; never keep an empty polling loop alive while decoding.
    if (shown !== target && shown !== beforePaint) request();
  }

  function stop() {
    cancelAnimationFrame(requested);
    clearTimeout(settleTimer);
    requested = 0;
    pose.freeze();
    pool.clear();
  }

  function preference() {
    const canAnimate = enabled();
    const nextPoster = canAnimate ? 1 : heroLast;
    if (nextPoster !== posterFrame) {
      poster.querySelector('source').srcset = renderFrame('warehouse', 'mobile', nextPoster);
      poster.querySelector('img').src = renderFrame('warehouse', 'desktop', nextPoster);
      posterFrame = nextPoster;
    }
    hero.toggleAttribute('data-hero-scrub', canAnimate);
    hero.classList.toggle('flight-still', !canAnimate);
    if (!canAnimate) {
      stop();
      hero.classList.remove('render-hero-ready');
      delete hero.dataset.renderFrame;
      delete hero.dataset.renderTarget;
    } else {
      shown = 0;
      warmSource();
      measure();
      request();
    }
  }

  function noteScroll() {
    if (scrollY !== lastY) {
      lastY = scrollY;
      lastMovement = performance.now();
      if (scrollY > 1) pose.freeze();
      clearTimeout(settleTimer);
      if (visible && enabled()) settleTimer = setTimeout(request, settleMs + 1);
    }
  }

  resetPool();
  preference();
  noteScroll();
  const view = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { source.prioritize(); request(); }
      else stop();
    },
    { rootMargin: '600px' },
  );
  view.observe(hero);
  const size = new ResizeObserver(() => {
    measure();
    request();
  });
  size.observe(hero);
  listen(
    window,
    'scroll',
    () => {
      noteScroll();
      request();
    },
    { passive: true },
  );
  listen(
    window,
    'resize',
    () => {
      measure();
      request();
    },
    { passive: true },
  );
  function changeCamera() {
    const nextProfile = profileFor();
    if (nextProfile === profile && sourceRoomProfile === roomProfile()) return;
    const previousFrame = target;
    pose.freeze();
    profile = nextProfile;
    resetPool();
    measure();
    // A breakpoint changes both the panel height and the available scroll
    // distance. Keep the scene at its current beat while the camera switches.
    if (enabled() && visible && previousFrame > 1 && previousFrame < heroLast) {
      let lo = anchors[0][0];
      let hi = anchors.at(-1)[0];
      for (let step = 0; step < 14; step++) {
        const middle = (lo + hi) / 2;
        if (samplePath(anchors, middle) < previousFrame) lo = middle;
        else hi = middle;
      }
      window.scrollTo({ top: (lo + hi) / 2, behavior: 'instant' });
    }
    request();
  }
  listen(camera, 'change', changeCamera);
  listen(portraitWarehouse, 'change', changeCamera);
  listen(tabletCamera, 'change', changeCamera);
  motionPreference.addEventListener('change', preference);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) stop();
    else request();
  });
  listen(window, 'pagehide', (event) => {
    stop();
    if (event.persisted) return;
    view.disconnect();
    size.disconnect();
    motionPreference.removeEventListener('change', preference);
    source.destroy();
    lifetime.abort();
  });
  listen(window, 'pageshow', request);
}
