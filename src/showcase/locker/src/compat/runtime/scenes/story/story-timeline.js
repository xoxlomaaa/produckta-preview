const clamp = (p, a = 0, b = 1) => Math.max(a, Math.min(b, p));
export const smooth = (a, b, p) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// A shape-preserving cubic curve keeps the path fluid without overshooting
// either the shared boundary or the reserved floor position.
export function samplePath(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  if (p >= keys.at(-1)[0]) return keys.at(-1)[1];
  const slopes = keys
    .slice(1)
    .map((k, i) => (k[1] - keys[i][1]) / (k[0] - keys[i][0]));
  const tangent = (i) => {
    if (i === 0) return slopes[0];
    if (i === keys.length - 1) return slopes.at(-1);
    const a = slopes[i - 1],
      b = slopes[i];
    if (a * b <= 0) return 0;
    const h0 = keys[i][0] - keys[i - 1][0],
      h1 = keys[i + 1][0] - keys[i][0],
      w0 = 2 * h1 + h0,
      w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  };
  const i = keys.findIndex((k, j) => j < keys.length - 1 && p < keys[j + 1][0]),
    [a, y0] = keys[i],
    [b, y1] = keys[i + 1],
    h = b - a,
    t = (p - a) / h;
  if (y0 === y1) return y0;
  return (
    (2 * t * t * t - 3 * t * t + 1) * y0 +
    (t * t * t - 2 * t * t + t) * h * tangent(i) +
    (-2 * t * t * t + 3 * t * t) * y1 +
    (t * t * t - t * t) * h * tangent(i + 1)
  );
}
export function storyState(progress, { reduced = false } = {}) {
  const p = reduced ? 0 : clamp(progress);
  const revealProgress = samplePath(
    [
      [0, 0],
      [0.035, 0.1],
      [0.14, 0.24],
      [0.285, 0.49],
      [0.345, 0.54],
      [0.485, 0.7],
      [1, 0.7],
    ],
    p,
  );
  return {
    progress: p,
    revealProgress,
    copyOpacity: reduced ? 1 : smooth(0.72, 0.97, p),
    landed: !reduced && p >= 0.99999,
    contact: p >= 0.94,
    landingBlend: smooth(0.4, 0.485, p),
    anchorWeight: smooth(0.16, 0.28, p) * (1 - smooth(0.36, 0.485, p)),
    landingRock: samplePath(
      [
        [0, 0],
        [0.8, 0],
        [0.91, -0.006],
        [0.94, 0],
        [0.952, 0.012],
        [0.972, -0.003],
        [1, 0],
      ],
      p,
    ),
    phase: reduced
      ? "still"
      : p < 0.035
        ? "held"
        : p < 0.14
          ? "untying"
          : p < 0.285
            ? "turning"
            : p < 0.345
              ? "inside"
              : p < 0.485
                ? "closing"
                : p < 0.94
                  ? "arriving"
                  : p < 0.99999
                    ? "settling"
                    : "stored",
  };
}
// Maximum scroll velocity, in story lengths per second. This only limits a
// wheel impulse; small gestures stay responsive and native inputs stay native.
export function storySpeed(p) {
  return samplePath(
    [
      [0, 0.42],
      [0.1, 0.32],
      [0.17, 0.25],
      [0.29, 0.32],
      [0.35, 0.29],
      [0.48, 0.52],
      [0.65, 0.85],
      [0.86, 0.6],
      [0.94, 0.12],
      [0.955, 0.065],
      [0.985, 0.065],
      [1, 0.7],
    ],
    clamp(p),
  );
}
export function actorFrame(
  progress,
  layout,
  landing,
  { reduced = false, idleTime = 0 } = {},
) {
  const p = reduced ? 0 : clamp(progress),
    { sky, warehouse, story, scrollY, mobile } = layout;
  const h = sky.height,
    initialHeight = Math.min(mobile ? 230 : 342, h * (mobile ? 0.35 : 0.47), mobile ? sky.width * .75 : Infinity);
  const initialX = sky.left + sky.width * (mobile ? 0.73 : 0.8);
  // Keep the balloon cluster partly above the sky even on a tall tablet.
  const initialY =
      sky.top + Math.min(h * (mobile ? 0.44 : 0.43), initialHeight * 1.4),
    boundary = (sky.top + h + warehouse.top) / 2;
  const landingX = warehouse.left + landing.x,
    landingY = warehouse.top + landing.y;
  // Desktop reveal moves gently into the sky. Rejoin the landing axis during
  // the closing turn, before the closed suitcase starts its vertical descent.
  const revealX=landingX-Math.min(130,sky.width*.13);
  const x = samplePath(
    mobile ? [
      [0, initialX],
      [0.14, initialX],
      [0.285, landingX],
      [1, landingX],
    ] : [[0,initialX],[.035,initialX],[.285,revealX],[.345,revealX],[.485,landingX],[1,landingX]],
    p,
  );
  const y = samplePath(
    [
      [0, initialY],
      [0.14, initialY + h * 0.065],
      [0.285, sky.top + h * 0.65],
      [0.345, sky.top + h * 0.70],
      [0.485, sky.top + h * 0.705],
      [0.67, boundary],
      [0.82, landingY - 72],
      [0.94, landingY],
      [1, landingY],
    ],
    p,
  );
  const height = samplePath(
    [
      [0, initialHeight],
      [0.14, initialHeight],
      [0.285, initialHeight * 1.2],
      [0.345, initialHeight * 1.2],
      [0.485, initialHeight * 1.2],
      [0.66, landing.height],
      [1, landing.height],
    ],
    p,
  );
  const sway = reduced ? 0 : 1 - smooth(0.08, 0.14, p);
  return {
    x: x + Math.sin(idleTime * 0.72) * 1.6 * sway,
    y: y - scrollY + Math.sin(idleTime * 0.62) * 2.2 * sway,
    height,
  };
}
