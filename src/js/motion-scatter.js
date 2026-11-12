// Stable shuffled cues within a group: varied entrances without runtime jitter.
export function createMotionScatter() {
  const schedules = new WeakMap();
  const anchorSelector = '.service, .industry-list > li, .steps > li, .team-member, .review-card, .partner-list > li, .faq-item, .request-fields > label, .cap-expertise-grid > article, .concept';

  return function scatterDelay(element, maximum) {
    const anchor = element.closest(anchorSelector) || element;
    const parent = anchor.parentElement;
    if (!parent) return 0;
    if (!schedules.has(parent)) {
      const siblings = [...parent.children];
      let seed = 2166136261;
      const key = `${parent.id}:${parent.className}:${siblings.length}`;
      for (const character of key) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
      const order = [...siblings.keys()];
      for (let index = order.length - 1; index > 0; index--) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const other = (seed >>> 0) % (index + 1);
        [order[index], order[other]] = [order[other], order[index]];
      }
      // Avoid an accidentally ordered row in either direction.
      const ordered = order.every((value, index) => index === 0 || value > order[index - 1]);
      const reversed = order.every((value, index) => index === 0 || value < order[index - 1]);
      if (order.length > 2 && (ordered || reversed)) [order[0], order[1]] = [order[1], order[0]];
      schedules.set(parent, new Map(order.map((childIndex, rank) => [siblings[childIndex], rank / Math.max(1, order.length - 1)])));
    }
    return Math.round((schedules.get(parent).get(anchor) || 0) * maximum);
  };
}
