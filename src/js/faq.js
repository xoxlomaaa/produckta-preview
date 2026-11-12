const instances = new WeakMap();

export function initFaq(root) {
  if (instances.has(root)) return instances.get(root);
  if (!Element.prototype.animate) return () => {};
  const life = new AbortController();
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const items = new Map([...root.querySelectorAll('.faq-item')].map(item => [item, {
    answer:item.querySelector('.faq-answer'), name:item.getAttribute('name'), open:item.open, animation:null,
  }]));
  // Native name-group closing hides the previous answer before it can animate.
  for (const item of items.keys()) item.removeAttribute('name');

  function settle(item, state) {
    const animation = state.animation;
    state.animation = null;
    item.open = state.open;
    item.removeAttribute('data-faq-closing');
    animation?.cancel();
  }

  function setOpen(item, open) {
    const state = items.get(item), answer = state.answer;
    const height = item.open ? answer.getBoundingClientRect().height : 0;
    const opacity = item.open ? getComputedStyle(answer).opacity : 0;
    state.animation?.cancel();
    state.animation = null;state.open = open;
    item.toggleAttribute('data-faq-closing', !open);
    if (preference.matches) {settle(item, state);return;}
    item.open = true;
    const animation = answer.animate([
      {height:`${height}px`, opacity, transform:`translateY(${height ? 0 : 4}px)`, overflow:'hidden'},
      {height:open ? `${answer.scrollHeight}px` : '0px', opacity:open ? 1 : 0, transform:`translateY(${open ? 0 : 3}px)`, overflow:'hidden'},
    ], {duration:open ? 360 : 280, easing:'cubic-bezier(.22,.68,.2,1)', fill:'both'});
    state.animation = animation;
    animation.finished.then(() => {
      if (state.animation === animation) settle(item, state);
    }, () => {});
  }

  root.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    const item = summary?.parentElement;
    if (!items.has(item) || event.defaultPrevented || event.button > 0) return;
    event.preventDefault();
    const open = !items.get(item).open;
    if (open) for (const [other, state] of items) if (other !== item && state.open) setOpen(other, false);
    setOpen(item, open);
  }, {signal:life.signal});
  root.addEventListener('toggle', event => {
    const state = items.get(event.target);
    if (!state || state.animation) return;
    state.open = event.target.open;
    if (state.open) for (const [other, otherState] of items) if (other !== event.target && otherState.open) setOpen(other, false);
  }, {capture:true, signal:life.signal});
  const finish = () => {for (const [item, state] of items) if (state.animation) settle(item, state);};
  let width = root.getBoundingClientRect().width;
  const resize = new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - width) < 1) return;
    width = entry.contentRect.width;finish();
  });
  resize.observe(root);
  preference.addEventListener('change', finish, {signal:life.signal});
  document.addEventListener('visibilitychange', () => {if (document.hidden) finish();}, {signal:life.signal});
  const destroy = () => {
    finish();life.abort();resize.disconnect();
    for (const [item, state] of items) if (state.name) item.setAttribute('name', state.name);
    instances.delete(root);
  };
  window.addEventListener('pagehide', event => {if (event.persisted) finish();else destroy();}, {signal:life.signal});
  instances.set(root, destroy);return destroy;
}
