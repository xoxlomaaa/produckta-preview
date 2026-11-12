/** A single motion preference shared by all scenes. Query override is for QA. */
const media = matchMedia("(prefers-reduced-motion: reduce)");
const forced = new URLSearchParams(location.search).get("motion") === "reduce";
export const motionPreference = {
  get matches() {
    return forced || media.matches;
  },
  addEventListener(type, listener) {
    media.addEventListener(type, listener);
  },
  removeEventListener(type, listener) {
    media.removeEventListener(type, listener);
  },
};
if (motionPreference.matches)
  document.documentElement.dataset.motion = "reduce";
media.addEventListener("change", () => {
  document.documentElement.dataset.motion = motionPreference.matches
    ? "reduce"
    : "full";
});
export const staticView =
  new URLSearchParams(location.search).get("view") === "still";
