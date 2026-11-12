// A short gesture every five seconds; the entrance remains owned by page-motion.
export function createHeroIdle(hero, {signal, reducedMotion}) {
  const duck = hero?.querySelector('.hero-duck-scene');
  if (!duck) return {start() {}, destroy() {}};

  const interval = 5000;
  const duration = 1000;
  let ready = false;
  let visible = false;
  let destroyed = false;
  let timer;
  let animation;

  const canPlay = () => ready && visible && !destroyed && !reducedMotion.matches && !document.hidden;

  function pause() {
    clearTimeout(timer);
    timer = undefined;
    animation?.cancel();
    animation = undefined;
  }

  function schedule(delay = interval) {
    if (!canPlay() || timer != null || animation) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!canPlay()) return;
      const style = getComputedStyle(duck);
      const angle = parseFloat(style.getPropertyValue('--hero-duck-rock-angle'));
      const lift = parseFloat(style.getPropertyValue('--hero-duck-rock-lift'));
      const frame = (rotation, y, offset) => ({
        transform: `translateY(${y}px) rotate(${rotation}deg)`, offset,
        easing: 'cubic-bezier(.45,0,.55,1)',
      });
      const gesture = duck.animate([
        frame(0, 0, 0),
        frame(-angle, -lift, .24),
        frame(angle * .6, 0, .52),
        frame(-angle * .22, -lift * .25, .78),
        frame(0, 0, 1),
      ], {duration, easing: 'linear', fill: 'none'});
      gesture.id = 'hero-duck:idle';
      animation = gesture;
      gesture.finished.then(() => {
        if (animation !== gesture) return;
        animation = undefined;
        schedule(interval - duration);
      }, () => { if (animation === gesture) animation = undefined; });
    }, delay);
  }

  function refresh() {
    pause();
    schedule();
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  observer.observe(duck);
  document.addEventListener('visibilitychange', refresh, {signal});
  window.addEventListener('resize', refresh, {signal});

  return {
    start() {
      if (ready || destroyed) return;
      ready = true;
      schedule();
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      pause();
    },
  };
}
