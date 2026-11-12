import {layers} from './construction-data.js';

export async function initRoof(root, parentSignal, scrollController) {
  if (root.dataset.initialized) return () => {};
  root.dataset.initialized = 'true';
  const life = new AbortController();
  const $ = (hook) => root.querySelector(`[data-roof-${hook}]`);
  const viewport = $('viewport');
  const poster = $('poster');
  const loadButton = $('load');
  const status = $('status');
  const explode = $('explode');
  const isolate = $('isolate');
  const touch = $('touch');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const disabledControls = [...root.querySelectorAll('button:disabled, input:disabled')];
  let viewer;
  let loading = false;
  let visible = false;
  let destroyed = false;
  let selected = '5';
  let isolated = false;
  let touchActive = false;
  let loadController;
  let autoLoadTimer = 0;
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, {...options, signal:life.signal});

  const buttons = layers.map((layer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.layer = layer.id;
    button.setAttribute('aria-pressed', String(layer.id === selected));
    const number = document.createElement('span');
    number.textContent = layer.id.padStart(2, '0');
    button.append(number, document.createTextNode(layer.name));
    $('layers').append(button);
    listen(button, 'click', () => select(layer.id));
    return button;
  });

  function select(id) {
    const layer = layers.find((item) => item.id === id);
    if (!layer) return;
    selected = id;
    viewer?.select(id);
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.layer === id)));
    $('layer-role').textContent = layer.role;
    $('layer-text').textContent = layer.text;
  }

  function gestures() {
    const enabled = pointer.matches || touchActive;
    if (viewer) {
      viewer.controls.enabled = enabled;
      viewer.controls.enableZoom = false;
      viewer.renderer.domElement.style.touchAction = touchActive ? 'none' : 'pan-y';
    }
    touch.setAttribute('aria-pressed', String(touchActive));
    touch.textContent = touchActive ? 'Готово' : 'Вращать модель';
  }

  function visibility() {
    if (!viewer) return;
    if (visible && !document.hidden) viewer.resume();
    else viewer.pause();
  }

  function reset() {
    isolated = false;
    isolate.setAttribute('aria-pressed', 'false');
    explode.value = '0';
    explode.style.setProperty('--range-progress','0%');
    $('explode-output').value = '0%';
    viewer?.setIsolation(false);
    viewer?.setExplode(0);
    select('5');
    viewer?.fit();
  }

  async function load() {
    clearTimeout(autoLoadTimer);
    if (loading || viewer?.ready || destroyed) return;
    loading = true;
    loadButton.disabled = true;
    loadButton.textContent = 'Загрузка…';
    status.textContent = 'Загружаем 3D-модель…';
    loadController = new AbortController();
    try {
      const {SystemViewer} = await import('./construction/viewer.js');
      if (destroyed) return;
      viewer?.dispose();
      viewer = new SystemViewer(viewport);
      gestures();
      viewer.addEventListener('select', (event) => select(event.detail), {signal:life.signal});
      viewer.addEventListener('reset', reset, {signal:life.signal});
      viewer.addEventListener('error', (event) => {
        status.textContent = event.detail;
        poster.hidden = false;
        loadButton.disabled = false;
        loadButton.textContent = 'Повторить загрузку';
      }, {signal:life.signal});
      await viewer.load('/showcase/construction/models/roof.glb', (progress) => {
        if (!destroyed) status.textContent = `Загружаем 3D-модель · ${Math.round(progress * 100)}%`;
      }, loadController.signal);
      if (destroyed) return;
      viewer.select(selected);
      poster.hidden = true;
      disabledControls.forEach((control) => {control.disabled = false;});
      root.dataset.modelReady = 'true';
      visibility();
    } catch (error) {
      if (destroyed || error.name === 'AbortError') return;
      viewer?.dispose();
      viewer = undefined;
      poster.hidden = false;
      status.textContent = 'Не удалось открыть 3D. Попробуйте ещё раз; описание слоёв доступно ниже.';
      loadButton.disabled = false;
      loadButton.textContent = 'Повторить загрузку';
      console.error('3D model:', error);
    } finally { loading = false; }
  }

  select(selected);
  gestures();
  // Loading Three.js while the previous scene is playing blocks its frames.
  // Start automatic loading only after this viewport is visible and scrolling
  // has settled; the explicit load button remains immediate.
  function scheduleAutoLoad() {
    clearTimeout(autoLoadTimer);
    if (!visible || loading || viewer?.ready || destroyed) return;
    autoLoadTimer = setTimeout(() => {
      if (scrollController?.moving) scheduleAutoLoad();
      else load();
    }, 200);
  }
  listen(window, 'scroll', scheduleAutoLoad, {passive: true});
  listen(loadButton, 'click', load);
  listen(explode, 'input', () => {
    explode.style.setProperty('--range-progress',`${explode.value}%`);
    viewer?.setExplode(Number(explode.value) / 100);
    $('explode-output').value = `${explode.value}%`;
  });
  listen(isolate, 'click', () => {
    isolated = !isolated;
    viewer?.setIsolation(isolated);
    isolate.setAttribute('aria-pressed', String(isolated));
  });
  listen(touch, 'click', () => {touchActive = !touchActive; gestures();});
  listen(pointer, 'change', () => {touchActive = false; gestures();});
  listen($('reset'), 'click', reset);
  root.querySelectorAll('[data-roof-zoom]').forEach((button) => listen(button, 'click', () => viewer?.zoom(button.dataset.roofZoom === 'in' ? 1 / 1.15 : 1.15)));
  listen(viewport, 'keydown', (event) => {
    if (event.key === 'Escape' && touchActive) {touchActive = false; gestures(); touch.focus();}
  });
  listen(document, 'visibilitychange', visibility);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible && touchActive) {touchActive = false; gestures();}
    visibility();
    scheduleAutoLoad();
  });
  observer.observe(viewport);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(autoLoadTimer);
    life.abort();
    loadController?.abort();
    observer.disconnect();
    viewer?.dispose();
    delete root.dataset.initialized;
  };
  parentSignal.addEventListener('abort', destroy, {once:true, signal:life.signal});
  if (parentSignal.aborted) destroy();
  return destroy;
}
