import { initAdmin } from './admin.js';
import {initSmoothScroll} from '../js/smooth-scroll.js';
import {initArchitecture} from './architecture-preview.js';

const lifetime = new AbortController();
const disposers = [];
// Shared with home.js: one velocity stream, including the embedded preview.
// Scene registration and frame prediction retain the render-story contract.
const wheel = initSmoothScroll();
const lazy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    lazy.unobserve(entry.target);
    if (entry.target.matches('[data-showcase-locker]')) {
      Promise.all([
        import('./locker/src/js/render-story/hero.js'),
        import('./locker/src/js/render-story/sky-clouds.js'),
      ]).then(([{initHeroRender}, {initSkyClouds}]) => {
        if (lifetime.signal.aborted) return;
        initHeroRender(wheel);
        initSkyClouds();
      }).catch((error) => console.error('Locker39 animation:', error));
    } else {
      import('./roof.js').then(async ({initRoof}) => {
        if (lifetime.signal.aborted) return;
        const destroy = await initRoof(entry.target, lifetime.signal, wheel);
        if (lifetime.signal.aborted) destroy();
        else disposers.push(destroy);
      }).catch((error) => console.error('Roof demo:', error));
    }
  }
}, {rootMargin:'600px'});
document.querySelectorAll('[data-showcase-locker], [data-roof-demo]').forEach((root) => lazy.observe(root));
const admin = document.querySelector('[data-admin-demo]');
if (admin) disposers.push(initAdmin(admin));
const architecture=document.querySelector('[data-architecture-preview]');
if(architecture)disposers.push(initArchitecture(architecture,wheel));
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  lifetime.abort();
  lazy.disconnect();
  disposers.forEach((destroy) => destroy());
}, {signal:lifetime.signal});
