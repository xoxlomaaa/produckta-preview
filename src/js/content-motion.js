// Explicit content targets only. Preview shells, scene roots and their ancestors
// must never become entrance targets: their transforms belong to the showcase.
export function isMotionInteraction(event) {
  if (event.type !== 'pointerdown' || event.pointerType !== 'touch') return true;
  const mobile = getComputedStyle(document.documentElement).getPropertyValue('--page-motion-mobile').trim() === '1';
  return !mobile || Boolean(event.target.closest('a, button, input, textarea, select, label, summary, [role="button"], [contenteditable]'));
}

export function initContentMotion({prepare, release, observe, play, settings, scatter, signal}) {
  const targets = new Map();

  function queue(element, {visual = false, description = false, edge = false, scattered = false} = {}) {
    if (!element || targets.has(element)) return;
    const state = {done: false, animation: null};
    targets.set(element, state);
    prepare(element);
    observe(element, () => {
      if (state.done) return;
      // Sample the actual CSS pose/state, including flipped ducks and buttons.
      release(element);
      const style = getComputedStyle(element);
      const base = style.transform;
      const {shift, duration, artShift, artDuration, stagger, scatter: spread, artScale} = settings();
      const pose = base === 'none' ? '' : `${base} `;
      state.animation = play(element, [
        {opacity: 0, transform: `${pose}translateY(${visual ? artShift : shift}px)${visual ? ` scale(${artScale})` : ''}`},
        {opacity: style.opacity, transform: base},
      ], {
        duration: visual ? artDuration : duration,
        delay: description ? stagger : scattered ? scatter(element, spread) : 0,
        name: visual ? 'content-visual' : 'content-text',
      });
      const complete = () => { state.done = true; targets.delete(element); };
      if (state.animation) state.animation.finished.then(complete, complete);
      else complete();
    }, {edge});
  }

  function family(selector, options = {}) {
    document.querySelectorAll(selector).forEach(element => queue(element, {scattered: true, ...options}));
  }

  // Main headings: Ideas keeps its already approved grouped entrance unchanged.
  const headingRoots = [
    '#services > .section-heading', '#process .process-intro',
    '#capabilities > .cap-heading', '#about .about-heading',
    '#faq .faq-intro', '#contacts .contact-intro',
  ];
  for (const selector of headingRoots) {
    const root = document.querySelector(selector);
    queue(root?.querySelector('h2'));
    queue(root?.querySelector('.section-description'), {description: true});
  }
  family('#reviews > h2, .industries-title, .partners-title', {scattered: false});
  family('#reviews > .section-description, .industries-panel > .section-description', {description: true});

  family('.service, .industry-list > li, .services-link');
  // Independent, shuffled cues rather than an ordered stage-index cascade.
  family('#process .steps > li');
  family('#process .process-duck', {visual: true});

  // Only text siblings of the live previews; never transform a live scene wrapper.
  family('.cap-project > .cap-project-heading', {scattered: false});
  family('.cap-project > .cap-project-description', {description: true});
  family('.cap-outro > p, .cap-outro > .button');
  family('.cap-locker-aside > p, .cap-locker-aside > span');
  family('.cap-locker-detail', {visual: true});

  family('.cap-expertise-research > *, .cap-expertise-story > *, .cap-expertise-merch-copy > *');
  family('.cap-expertise-merch-visual > img', {visual: true});
  family('.about-specialties, .team-member > figcaption');
  // The filled frame moves as a unit; never slide the bitmap off its backing.
  family('.team-photo', {visual: true});
  // The coloured review backgrounds and brand graphics remain stationary.
  family('.review-card > *, .partner-list > li');
  family('.faq-duck, .contact-duck', {visual: true});
  family('.faq-item, .contact-caption');
  family('.request > .request-group, .request-fields > label, .request-consent, .request-submit, .request-note');
  family('.footer-main > div');
  family('.footer-bottom > small, .footer-bottom > .footer-policy', {edge: true});

  function settleInteraction(event) {
    if (!isMotionInteraction(event)) return;
    for (let element = event.target; element instanceof Element; element = element.parentElement) {
      const state = targets.get(element);
      if (!state) continue;
      state.done = true;
      release(element);
      state.animation?.cancel();
      targets.delete(element);
    }
  }
  // Inputs, native FAQ and links respond immediately, including keyboard entry
  // into an element that has not reached its intersection trigger yet.
  document.addEventListener('focusin', settleInteraction, {signal});
  document.addEventListener('pointerdown', settleInteraction, {signal});
  signal.addEventListener('abort', () => targets.clear(), {once: true});
}
