const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Павел/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const base=process.env.CHECK_URL||'http://127.0.0.1:4330/',out='output/qa/sticky-header';fs.mkdirSync(out,{recursive:true});
// Tap at viewport coordinates: locator.tap() can auto-scroll a sticky descendant.
async function tapMenu(page){const box=await page.locator('.mobile-menu-trigger').boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];try{
 for(const size of (process.env.CHECK_SIZES||'320x740,375x812,390x844,430x932,768x1024,1024x768,1280x720,1920x1080,2560x1440').split(',')){
  const [width,height]=size.split('x').map(Number);const p=await browser.newPage({viewport:{width,height},isMobile:width<800,hasTouch:width<800});const errors=[],bad=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});await p.goto(base);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
  const header=p.locator('.site-header-wrap'),originalHeight=await header.evaluate(e=>e.offsetHeight);
  for(const selector of ['#services','#process','#architecture-showcase','[data-showcase-locker]','#construction-showcase','#about','#faq','#contacts','footer']){
   await p.locator(selector).evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)-24,behavior:'instant'}));await p.waitForTimeout(80);
   const rect=await header.boundingBox();assert(Math.abs(rect.y)<1,`${size}: header left viewport at ${selector}`);assert.equal(Math.round(rect.height),originalHeight);
  }
  assert(await header.evaluate(e=>e.classList.contains('is-scrolled')));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);
  if(width<1024){
   await tapMenu(p);await p.waitForTimeout(360);assert(await p.locator('.mobile-menu').evaluate(e=>e.open));
   await p.locator('.mobile-menu-links a[href="#services"]').tap();
  }else await p.locator('.desktop-nav a[href="#services"]').click();
  await p.waitForFunction(()=>{const header=document.querySelector('.site-header-wrap').getBoundingClientRect(),anchor=document.querySelector('#services').getBoundingClientRect();return anchor.top>=header.bottom-1&&anchor.top<header.bottom+45;},{},{timeout:6000});
  await p.waitForTimeout(450); // Let the native anchor scroll finish before reopening the menu.
  const anchor=await p.locator('#services').boundingBox();const pinned=await header.boundingBox();assert(anchor.y>=pinned.height-1,`${size}: title under header`);assert(anchor.y<pinned.height+45);
  if(width<1024){const beforeMenu=await p.evaluate(()=>scrollY);await tapMenu(p);await p.waitForTimeout(360);await p.locator('.mobile-menu-close').tap();assert.equal(await p.locator('.mobile-menu').evaluate(e=>e.open),false);await p.waitForTimeout(360);assert(Math.abs(await p.evaluate(()=>scrollY)-beforeMenu)<=1,`${size}: menu changed page position`);}
  if(width===390||width===1920)await p.screenshot({path:`${out}/scrolled-${size}.png`});
  // The whole architecture browser must fit in the space below the sticky bar.
  await p.locator('[data-architecture-preview]').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-150,behavior:'instant'}));
  await p.waitForFunction(()=>document.querySelector('[data-architecture-frame]').dataset.scrollReady==='true');
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(150);
  const shell=p.locator('[data-architecture-preview] .cap-site-shell');await shell.evaluate(e=>{const h=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);scrollTo({top:scrollY+e.getBoundingClientRect().top+(e.getBoundingClientRect().height-innerHeight-h)/2,behavior:'instant'});});
  const box=await shell.boundingBox();assert(box.y>=originalHeight+10,`${size}: preview covered`);assert(box.y+box.height<=height-10,`${size}: preview cut off`);
  const child=await(await p.locator('[data-architecture-frame]').elementHandle()).contentFrame();const before=await child.evaluate(()=>scrollY),outer=await p.evaluate(()=>scrollY);
  await p.mouse.move(1,Math.min(height-2,originalHeight+20));await p.mouse.wheel(0,200);await p.waitForTimeout(700);
  assert(await child.evaluate(()=>scrollY)>before);assert(Math.abs(await p.evaluate(()=>scrollY)-outer)<=1);
  await child.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight-innerHeight,behavior:'instant'}));await p.waitForTimeout(80);
  await p.mouse.wheel(0,200);await p.waitForTimeout(700);assert(await p.evaluate(()=>scrollY)>outer+10);
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);results.push({size,height:originalHeight,sticky:true,anchors:true,menu:true,previewFits:true,scrollHandoff:true,errors,bad});await p.close();
 }
 const keyboard=await browser.newPage();await keyboard.goto(base);await keyboard.keyboard.press('Tab');assert.equal(await keyboard.locator('.skip').evaluate(e=>document.activeElement===e),true);await keyboard.keyboard.press('Enter');assert.equal(await keyboard.locator('#main').evaluate(e=>document.activeElement===e),true);await keyboard.close();
 fs.writeFileSync(`${out}/${process.env.CHECK_LABEL||'local'}.json`,JSON.stringify({base,results,skipLink:true},null,2));console.log(JSON.stringify({base,sizes:results.map(r=>r.size),sticky:true,anchors:true,menu:true,preview:true,skipLink:true}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
