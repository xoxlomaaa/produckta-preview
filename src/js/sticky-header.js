const instances = new WeakMap();

export function initStickyHeader(header) {
  if (!header) return () => {};
  if (instances.has(header)) return instances.get(header);
  const life = new AbortController();
  let scrolled, height = 0;
  const updateScroll = () => {
    const next = scrollY > 8;
    if (next === scrolled) return;
    scrolled = next;header.classList.toggle('is-scrolled', next);
  };
  const measure = () => {
    const next = header.offsetHeight;
    if (!next || next === height) return;
    height = next;
    document.documentElement.style.setProperty('--site-header-height', `${height}px`);
    window.dispatchEvent(new Event('produckta:header-resize'));
  };
  const resize = new ResizeObserver(measure);
  resize.observe(header);measure();updateScroll();
  window.addEventListener('scroll', updateScroll, {passive:true, signal:life.signal});
  const destroy = () => {resize.disconnect();life.abort();instances.delete(header);};
  window.addEventListener('pagehide', event => {if (!event.persisted) destroy();}, {signal:life.signal});
  instances.set(header, destroy);return destroy;
}
