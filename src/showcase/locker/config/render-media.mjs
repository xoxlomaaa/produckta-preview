export const renderPrefix = '/showcase/locker/assets/render-v1';
export const heroLast = 265;
export const skyLast = 190;
export const warehouseFirstMoving = 150;
export const fridgeLast = 481;
export const fridgeFps = 30;

export const renderProfiles = {
  desktop: { sky: [1530, 1116], warehouse: [1920, 1013], fridge: [2880, 1520] },
  mobile: { sky: [768, 960], warehouse: [728, 1084], fridge: [1170, 1680] },
};

export function renderFrame(kind, profile, frame) {
  const prefix = profile === 'desktop' && (kind === 'sky' || kind === 'warehouse')
    ? '/showcase/locker/assets/render-v2'
    : renderPrefix;
  return `${prefix}/${kind}-${profile}/${String(frame).padStart(4, '0')}.webp`;
}

export function fridgeVideo(profile) {
  return `${renderPrefix}/fridge-${profile}/movie.mp4`;
}

export const renderFiles = Object.keys(renderProfiles).flatMap((profile) => [
  ...Array.from({ length: skyLast }, (_, i) => renderFrame('sky', profile, i + 1)),
  renderFrame('warehouse', profile, 1),
  ...Array.from({ length: heroLast - warehouseFirstMoving + 1 }, (_, i) =>
    renderFrame('warehouse', profile, i + warehouseFirstMoving),
  ),
  ...[1, 294, fridgeLast].map((frame) => renderFrame('fridge', profile, frame)),
  fridgeVideo(profile),
]);
