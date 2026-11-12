import {createHeroIdle} from './hero-idle.js';
import {initContentMotion, isMotionInteraction} from './content-motion.js';
import {createMotionScatter} from './motion-scatter.js';

// Scoped entrances and the Hero's idle gesture. Never transform preview ancestors.
let dispose;

export function initPageMotion() {
  dispose?.();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const listeners = new AbortController();
  const animations = new Set();
  const pending = new Map();
  const edgeTargets = new Set();
  const prepared = new Set();
  const scatter = createMotionScatter();
  let destroyed = false;
  let settleHero = () => {};
  const hero = document.querySelector('.hero');
  const heroIdle = createHeroIdle(hero, {signal: listeners.signal, reducedMotion});

  function settings() {
    const style = getComputedStyle(document.documentElement);
    const value = (name) => parseFloat(style.getPropertyValue(`--page-motion-${name}`));
    return {
      shift: value('shift'), turn: value('turn'), stagger: value('stagger'),
      duration: value('duration'),
      artShift: value('art-shift'), artDuration: value('art-duration'), scatter: value('scatter'),
      artScale: value('art-scale'), artDelay: value('art-delay'),
    };
  }

  function prepare(element) {
    if (!element) return;
    element.classList.add('page-motion-pending');
    prepared.add(element);
  }

  function release(element) {
    element.classList.remove('page-motion-pending');
    prepared.delete(element);
  }

  function play(element, frames, {duration, delay = 0, name, startTime}) {
    release(element);
    if (destroyed || reducedMotion.matches) return;
    const animation = element.animate(frames, {
      duration, delay, easing: 'cubic-bezier(.25,.46,.3,1)', fill: 'backwards',
    });
    animation.id = `page-motion:${name}`;
    if (startTime != null) animation.startTime = startTime;
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }

  function reveal(element, delay = 0, name = 'text') {
    if (!element) return;
    const {shift, duration} = settings();
    play(element, [
      {opacity: 0, transform: `translateY(${shift}px)`},
      {opacity: 1, transform: 'translateY(0)'},
    ], {duration, delay, name});
  }

  function enterVisible(entries, source) {
    if (source !== observer && source !== edgeObserver) return;
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      edgeObserver.unobserve(target);
      edgeTargets.delete(target);
      const entrance = pending.get(target);
      pending.delete(target);
      entrance?.();
    }
  }
  function observationOptions() {
    const style = getComputedStyle(document.documentElement);
    return {
      threshold: parseFloat(style.getPropertyValue('--page-motion-trigger-threshold')),
      rootMargin: style.getPropertyValue('--page-motion-trigger-margin').trim(),
    };
  }
  let observerOptions = observationOptions();
  let observer = new IntersectionObserver(enterVisible, observerOptions);
  // The final footer row cannot scroll above a negative bottom margin.
  const edgeObserver = new IntersectionObserver(enterVisible, {threshold: .1});

  function observe(element, entrance, {edge = false} = {}) {
    if (!element) return;
    pending.set(element, entrance);
    if (edge) edgeTargets.add(element);
    (edge ? edgeObserver : observer).observe(element);
  }

  function updateObserver() {
    const next = observationOptions();
    if (next.threshold === observerOptions.threshold && next.rootMargin === observerOptions.rootMargin) return;
    observer.disconnect();
    observerOptions = next;
    observer = new IntersectionObserver(enterVisible, next);
    for (const element of pending.keys()) if (!edgeTargets.has(element)) observer.observe(element);
  }

  if (hero && hero.getBoundingClientRect().bottom > 0 && scrollY < 100) {
    const header = document.querySelector('.site-header');
    const actors = [
      {element: document.querySelector('.hero-backdrop'), name: 'backdrop', cue: 0, duration: 1600, kind: 'fade'},
      {element: header, name: 'header', cue: 0, duration: 750, kind: 'header'},
      {element: hero.querySelector('.hero-art'), name: 'scene', cue: 80, duration: 1450, kind: 'scene'},
      {element: hero.querySelector('h1'), name: 'title', cue: 160, duration: 1100, kind: 'copy'},
      {element: hero.querySelector('.hero-description'), name: 'description', cue: 280, duration: 1050, kind: 'support'},
      {element: hero.querySelector('.hero-copy > .button'), name: 'cta', cue: 380, duration: 950, kind: 'support'},
      {element: hero.querySelector('.hero-experience'), name: 'experience', cue: 440, duration: 1000, kind: 'fade'},
    ].filter(({element}) => element);
    actors.forEach(({element}) => prepare(element));
    let started = false;
    let cancelled = false;
    let readyTimeout;

    settleHero = () => {
      cancelled = true;
      clearTimeout(readyTimeout);
      for (const {element} of actors) {
        observer.unobserve(element);
        pending.delete(element);
        release(element);
      }
      for (const animation of animations) {
        if (animation.id.startsWith('page-motion:hero-')) animation.cancel();
      }
      if (!destroyed && !reducedMotion.matches) heroIdle.start();
    };

    function beginHero() {
      if (started || destroyed || cancelled) return;
      started = true;
      clearTimeout(readyTimeout);
      if (scrollY >= 100) { settleHero(); return; }
      const style = getComputedStyle(document.documentElement);
      const lift = parseFloat(style.getPropertyValue('--hero-motion-lift'));
      const copyLift = parseFloat(style.getPropertyValue('--hero-motion-copy-lift'));
      const pace = parseFloat(style.getPropertyValue('--hero-motion-duration')) / 1450;
      const startTime = document.timeline.currentTime;
      // Measure every actor before starting the parent scene's transform.
      const visible = new Map(actors.map(({element}) => {
        const bounds = element.getBoundingClientRect();
        return [element, bounds.top < innerHeight * .94 && bounds.bottom > 0];
      }));
      for (const actor of actors) {
        const {element, name, kind, cue, duration} = actor;
        let frames;
        if (kind === 'scene') {
          // One parent moves the original complete illustration and its experience block.
          frames = [
            {opacity: 0, transform: `translateY(${lift}px) scale(.98)`},
            {opacity: 1, transform: 'translateY(0) scale(1)'},
          ];
        } else if (kind === 'fade') {
          frames = [{opacity: 0}, {opacity: 1}];
        } else {
          const shift = kind === 'header' ? -12 : kind === 'copy' ? copyLift : copyLift * .6;
          frames = [
            {opacity: 0, transform: `translateY(${shift}px)`},
            {opacity: 1, transform: 'translateY(0)'},
          ];
        }
        const enter = (delay, clock) => {
          if (cancelled) return;
          const animation = play(element, frames, {duration: duration * pace, delay, startTime: clock, name: `hero-${name}`});
          if (name === 'scene') animation?.finished.then(() => heroIdle.start(), () => {});
        };
        if (visible.get(element)) enter(cue * pace, startTime);
        else observe(element, () => enter(0, document.timeline.currentTime));
      }
    }

    // Share one clock after essential assets settle; never install a page loader.
    readyTimeout = setTimeout(beginHero, 350);
    const illustrations = [...hero.querySelectorAll('.hero-skate-scene')];
    Promise.allSettled([document.fonts.ready, ...illustrations.map(image => image.decode())]).then(beginHero);
    for (const surface of [header, hero].filter(Boolean)) {
      surface.addEventListener('focusin', settleHero, {signal: listeners.signal});
      surface.addEventListener('pointerdown', event => { if (isMotionInteraction(event)) settleHero(); }, {signal: listeners.signal});
    }
  } else heroIdle.start();

  for (const selector of ['#scenes .section-heading']) {
    const heading = document.querySelector(selector);
    heading?.querySelectorAll('h2, .section-description').forEach(prepare);
    observe(heading, () => {
      const {stagger} = settings();
      reveal(heading.querySelector('h2'), 0, 'section-title');
      reveal(heading.querySelector('.section-description'), stagger, 'section-description');
    });
  }

  document.querySelectorAll('#scenes .concept').forEach((card, index) => {
    prepare(card.querySelector('h3'));
    observe(card, () => {
      reveal(card.querySelector('h3'), scatter(card, settings().scatter), 'concept-title');
    });
    const art = card.querySelector('.laptop-art, .phone-art, .tote-art');
    if (!art) return;
    prepare(art);
    // Trigger the illustration itself, not the card's earlier, distant top edge.
    observe(art, () => {
      const {artShift, turn, scatter: spread, artDuration, artScale, artDelay} = settings();
      const base = getComputedStyle(art).transform;
      const rotation = index % 2 ? turn : -turn;
      play(art, [
        {opacity: 0, transform: `${base} translateY(${artShift}px) rotate(${rotation}deg) scale(${artScale})`},
        {opacity: 1, transform: base},
      ], {duration: artDuration, delay: artDelay + scatter(card, spread), name: 'concept-art'});
    });
  });

  initContentMotion({prepare, release, observe, play, settings, scatter, signal: listeners.signal});

  function cancelAnimations() {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  }

  function destroy() {
    destroyed = true;
    heroIdle.destroy();
    settleHero();
    observer.disconnect();
    edgeObserver.disconnect();
    pending.clear();
    edgeTargets.clear();
    prepared.forEach(release);
    cancelAnimations();
    listeners.abort();
  }

  let viewportWidth = innerWidth;
  window.addEventListener('resize', () => {
    const widthChanged = innerWidth !== viewportWidth;
    viewportWidth = innerWidth;
    const mobile = getComputedStyle(document.documentElement).getPropertyValue('--page-motion-mobile').trim() === '1';
    // Browser chrome/keyboard changes the mobile height during a normal swipe.
    if (mobile && !widthChanged) return;
    settleHero();
    cancelAnimations();
    updateObserver();
  }, {signal: listeners.signal});
  reducedMotion.addEventListener('change', (event) => { if (event.matches) destroy(); }, {signal: listeners.signal});
  window.addEventListener('pagehide', destroy, {once: true, signal: listeners.signal});
  dispose = destroy;
  return destroy;
}
