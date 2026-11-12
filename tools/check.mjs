import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const dist = new URL("../dist/", import.meta.url);
const html = await readFile(new URL("index.html", dist), "utf8");
const css = await readFile(new URL("styles/home.css", dist), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Duplicate IDs");
assert.equal([...html.matchAll(/<h1\b/g)].length, 1, "Expected one H1");
assert.match(html, /name="robots" content="noindex, follow"/, "Preview must stay outside indexing");

for (const [, fragment] of html.matchAll(/href="#([^"]+)"/g)) {
  assert(ids.includes(fragment), `Missing anchor: #${fragment}`);
}
for (const [, file] of html.matchAll(/\.\/(assets\/[^" ,]+|styles\/[^" ,]+|js\/[^" ,]+)/g)) {
  await access(new URL(file, dist));
}
for (const [, file] of css.matchAll(/url\("\.\.\/(assets\/[^"]+)"\)/g)) {
  await access(new URL(file, dist));
}

for (const [file, limit] of [["index.html", 25], ["styles/home.css", 35], ["styles/page-motion.css", 4], ["js/home.js", 30], ["js/page-motion.js", 5], ["js/hero-idle.js", 3], ["js/content-motion.js", 4], ["js/motion-scatter.js", 2]]) {
  const bytes = gzipSync(await readFile(new URL(file, dist))).length;
  assert(bytes <= limit * 1024, `${file} exceeds ${limit} KiB gzip budget`);
  console.log(`${file}: ${(bytes / 1024).toFixed(1)} KiB gzip`);
}
const heroPhoto = await stat(new URL("assets/illustrations/architecture-480.webp", dist));
const heroRamp = await stat(new URL("assets/illustrations/hero-ramp-layer.svg", dist));
const heroDuck = await stat(new URL("assets/illustrations/hero-duck-layer.svg", dist));
const heroArtBytes = heroPhoto.size + heroRamp.size + heroDuck.size;
assert(heroArtBytes <= 130 * 1024, "Hero art exceeds 130 KiB");
console.log(`Hero art: ${(heroArtBytes / 1024).toFixed(1)} KiB uncompressed`);
console.log("Static links, assets, preview indexing and resource budgets passed.");
