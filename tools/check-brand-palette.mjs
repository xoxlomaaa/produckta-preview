import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

// Brandbook, page 6. Derived surfaces may mix these colors with white.
const palette = new Set(['4c3f53', '454a5d', '78a5a2', 'e0af6a', 'cd5a57', 'ffffff']);
const rgb = new Set(['76,63,83', '69,74,93', '120,165,162', '224,175,106', '205,90,87', '255,255,255']);
const cssFiles = ['src/styles/home.css', 'src/styles/faq.css', 'src/showcase/showcase.css', 'src/showcase/rental.css', 'src/showcase/expertise.css'];
const errors = [];
const expand = value => value.length <= 4 ? [...value].map(c => c+c).join('') : value;
for (const file of cssFiles) {
  const source = await readFile(file, 'utf8');
  for (const line of source.split('\n')) {
    // Original sky and warehouse backplates are part of the rendered scene.
    const scene = file === 'src/showcase/showcase.css' && /\.locker-scene \.(hero-sky|hero-warehouse) \{/.test(line);
    for (const match of line.matchAll(/#([a-f\d]{3,8})\b/gi)) {
      const hex = expand(match[1].toLowerCase());
      const mask = hex === '000000' && /mask-image:/.test(line);
      if (!palette.has(hex.slice(0,6)) && !scene && !mask) errors.push(`${file}: ${match[0]}`);
    }
    for (const match of line.matchAll(/rgba?\(([^)]+)\)/g)) {
      if (!rgb.has(match[1].split(',').slice(0,3).map(c => c.trim()).join(','))) errors.push(`${file}: ${match[0]}`);
    }
  }
}
for (const dir of ['assets/brand', 'assets/illustrations', 'assets/partners']) {
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.svg')) continue;
    const file = `${dir}/${name}`;
    for (const match of (await readFile(file, 'utf8')).matchAll(/#([a-f\d]{3,8})\b/gi)) {
      const hex = expand(match[1].toLowerCase());
      if (!palette.has(hex.slice(0,6)) && hex !== '000000') errors.push(`${file}: ${match[0]}`);
    }
  }
}
const faq = await readFile('src/styles/faq.css', 'utf8');
assert(!/nth-child|--faq-toggle-(bg|ink)/.test(faq), 'FAQ must use one neutral control theme');
assert.match(faq, /border: var\(--control-border\) solid var\(--slate\)/, 'FAQ uses thin slate borders');
assert.deepEqual(errors, [], 'Colors outside the brand palette');
console.log('Brand palette: 5 UI stylesheets and local brand/mascot/partner SVGs passed; FAQ uses a single slate theme.');
