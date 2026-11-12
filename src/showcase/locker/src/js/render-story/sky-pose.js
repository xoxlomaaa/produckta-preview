import { smooth } from '../../compat/runtime/scenes/story/story-timeline.js';

export function skyPose(canvas) {
  const liftLimit = 7;
  let animation;
  let lift = 0;
  let zoom = 1;
  const transform = (y, scale) => `translateY(${y}px) scale(${scale})`;

  function measure() {
    zoom = Number(getComputedStyle(canvas).getPropertyValue('--hero-start-zoom')) || 1;
  }

  function freeze() {
    if (!animation) return;
    const current = getComputedStyle(canvas).transform;
    lift = current === 'none' ? 0 : Math.min(0, new DOMMatrixReadOnly(current).m42);
    animation.cancel();
    animation = null;
    canvas.style.transform = transform(lift, zoom);
  }

  function present(frame, idle) {
    if (!idle) freeze();
    if (animation) return;
    const weight = 1 - smooth(1, 82, frame);
    const initial = transform(lift * weight, 1 + (zoom - 1) * weight);
    canvas.style.transform = initial;
    if (!idle) return;
    animation = canvas.animate(
      [
        { transform: initial, offset: 0, easing: 'ease-in-out' },
        {
          transform: transform(-liftLimit, zoom),
          offset: 0.32,
          easing: 'ease-in-out',
        },
        { transform: transform(0, zoom), offset: 0.82, easing: 'ease-in-out' },
        { transform: initial, offset: 1 },
      ],
      { duration: 5600, iterations: Infinity },
    );
  }

  return { measure, freeze, present };
}
