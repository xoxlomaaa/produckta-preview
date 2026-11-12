import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {applyPublishBase} from './publish-paths.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));

export async function buildSite({output=resolve(root,'dist'),experimental=false,basePath=process.env.SITE_BASE_PATH||'/'}={}) {
  const dist=resolve(output);
  // Only these explicit, resolved workspace outputs may be cleared recursively.
  const allowed=[resolve(root,'dist'),resolve(root,'experiments/capabilities/dist'),resolve(root,'output/publish/site')];
  if(!allowed.includes(dist))throw new Error('Unrecognized build output: '+dist);
  await rm(dist,{recursive:true,force:true});
  await mkdir(resolve(dist,'assets'),{recursive:true});
  await cp(resolve(root,'src'),dist,{recursive:true});
  for(const name of ['brand','fonts','illustrations','team','partners']) {
    await cp(resolve(root,'assets',name),resolve(dist,'assets',name),{recursive:true});
  }
  // Pinned local resources: build works without donor sites or experiment files.
  await cp(resolve(root,'assets/showcase'),resolve(dist,'showcase'),{recursive:true});
  const rental=await readFile(resolve(root,'templates/components/rental.html'),'utf8');
  const expertise=await readFile(resolve(root,'templates/components/expertise.html'),'utf8');
  const section=(await readFile(resolve(root,'templates/sections/capabilities.html'),'utf8'))
    .replace('<!-- rental-demo -->',rental)
    .replace('<!-- expertise-cases -->',expertise);
  let html=await readFile(resolve(root,'src/index.html'),'utf8');
  const faq=await readFile(resolve(root,'templates/sections/faq.html'),'utf8');
  if(!html.includes('<!-- capabilities -->'))throw new Error('Capabilities insertion point missing');
  if(!html.includes('<!-- faq -->'))throw new Error('FAQ insertion point missing');
  html=html.replace('<!-- capabilities -->',section);
  html=html.replace('<!-- faq -->',faq);
  if(experimental)html=html.replace('<title>','<title>Эксперимент · ');
  await writeFile(resolve(dist,'index.html'),html);
  await applyPublishBase(dist,basePath);
  await writeFile(resolve(dist,'.nojekyll'),'');
  console.log('Built '+resolve(dist,'index.html'));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildSite();
