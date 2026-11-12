import {readdir, readFile, writeFile} from 'node:fs/promises';
import {extname, join} from 'node:path';

// Keep localhost rooted at /; only deployment output receives a repository prefix.
export async function applyPublishBase(directory, basePath) {
  if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(basePath) || basePath.split('/').includes('..')) {
    throw new Error('SITE_BASE_PATH must be an absolute directory path ending in /');
  }
  if (basePath === '/') return;
  const textTypes = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);
  async function visit(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) { await visit(file); continue; }
      if (!textTypes.has(extname(file))) continue;
      const source = await readFile(file, 'utf8');
      // Includes HTML/srcset, import maps, CSS URLs, JS strings and worker paths.
      // Relative paths, protocol URLs and external links are deliberately preserved.
      let result = source.replace(/(["'`(\s,])\/(showcase|assets)(?=\/|["'`\s),])/g,
        (_, lead, root) => `${lead}${basePath}${root}`);
      // Vite's preloader adds its own leading slash to these dependency entries.
      if (source.includes('__vite__mapDeps')) {
        result = result.replace(/(["'`])showcase\/architecture\/_astro\//g,
          (_, quote) => `${quote}${basePath.slice(1)}showcase/architecture/_astro/`);
      }
      if (result !== source) await writeFile(file, result);
    }
  }
  await visit(directory);
}
