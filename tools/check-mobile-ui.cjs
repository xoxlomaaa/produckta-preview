const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Павел/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const base=process.env.CHECK_URL||'http://127.0.0.1:4330/',out='output/qa/mobile-ui';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const reports=[];try{
 for(const width of (process.env.CHECK_WIDTHS||'320,375,390,430,768,1920').split(',').map(Number)){
  const p=await browser.newPage({viewport:{width,height:width<800?844:1080},isMobile:width<800,hasTouch:width<800});const errors=[],bad=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});});await p.goto(base);await p.evaluate(()=>document.fonts.ready);
  if(width<1024){
   await p.locator('.mobile-menu-trigger').tap();await p.waitForTimeout(380);
   const close=p.locator('.mobile-menu-close');const center=await close.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg').getBoundingClientRect();return{dx:Math.abs(a.x+a.width/2-b.x-b.width/2),dy:Math.abs(a.y+a.height/2-b.y-b.height/2),width:a.width,height:a.height,padding:getComputedStyle(e).padding};});
   assert(center.dx<1&&center.dy<1);assert(center.width>=44&&center.height>=44);assert.equal(center.padding,'0px');
   await p.locator('.mobile-menu-top').screenshot({path:`${out}/menu-${width}.png`});await close.tap();assert.equal(await p.locator('.mobile-menu').evaluate(e=>e.open),false);
   await p.locator('.mobile-menu-trigger').click();await p.keyboard.press('Escape');assert.equal(await p.locator('.mobile-menu').evaluate(e=>e.open),false);
  }
  await p.locator('[data-roof-viewport]').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-70,behavior:'instant'}));await p.waitForSelector('[data-roof-viewport][data-model-ready="true"]',{timeout:60000});
  const roof=await p.locator('.cap-roof-shell').evaluate(e=>{const r=s=>e.querySelector(s).getBoundingClientRect().toJSON();return{stage:r('.cap-roof-stage'),toolbar:r('.cap-roof-toolbar'),details:r('.cap-roof-details'),icons:[...e.querySelectorAll('.cap-zoom button')].map(b=>{const a=b.getBoundingClientRect(),i=b.querySelector('svg').getBoundingClientRect();return{dx:Math.abs(a.x+a.width/2-i.x-i.width/2),dy:Math.abs(a.y+a.height/2-i.y-i.height/2),width:a.width,height:a.height,stroke:getComputedStyle(b.querySelector('svg')).stroke};})};});
  for(const icon of roof.icons)assert(icon.dx<1&&icon.dy<1&&icon.width>=44&&icon.height>=44&&icon.stroke!=='none');
  if(width<960){assert(roof.toolbar.top>=roof.stage.bottom-1);assert(roof.toolbar.bottom<=roof.details.top+1);}else{assert(Math.abs(roof.stage.top-roof.details.top)<1);assert(roof.toolbar.top>=roof.stage.bottom-1);}
  await p.locator('[data-roof-explode]').evaluate(e=>{e.value='60';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(500);assert.equal(await p.locator('[data-roof-explode-output]').innerText(),'60%');
  await p.locator('[data-roof-isolate]').evaluate(e=>e.click());assert.equal(await p.locator('[data-roof-isolate]').getAttribute('aria-pressed'),'true');await p.locator('[data-roof-reset]').evaluate(e=>e.click());
  if(width===390||width===1920)await p.locator('.cap-roof-shell').screenshot({path:`${out}/roof-${width}.png`});
  await p.locator('#faq').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-40,behavior:'instant'}));await p.waitForTimeout(700);
  const items=p.locator('.faq-item'),second=items.nth(1);await second.locator('summary').click();await p.waitForTimeout(75);
  const mid=await second.locator('.faq-answer').evaluate(e=>({height:e.getBoundingClientRect().height,full:e.scrollHeight,animations:e.getAnimations().length}));assert(mid.animations>0&&mid.height>0&&mid.height<mid.full);
  await p.waitForTimeout(450);assert.equal(await p.locator('.faq-item[open]').count(),1);assert(await second.evaluate(e=>e.open));
  // Reverse an in-flight close instead of queuing clicks or leaving a fixed height.
  await second.locator('summary').click();await p.waitForTimeout(70);const closing=await second.locator('.faq-answer').evaluate(e=>({height:e.getBoundingClientRect().height,full:e.scrollHeight}));assert(closing.height>0&&closing.height<closing.full);
  await second.locator('summary').click();await p.waitForTimeout(450);assert(await second.evaluate(e=>e.open));assert.equal(await second.locator('.faq-answer').evaluate(e=>e.getAnimations().length),0);
  await second.locator('summary').focus();await p.keyboard.press('Enter');await p.waitForTimeout(350);assert.equal(await second.evaluate(e=>e.open),false);
  await p.keyboard.press('Space');await p.waitForTimeout(450);assert(await second.evaluate(e=>e.open));
  const overflow=[];for(const selector of ['#services','#scenes','#process','#capabilities','#about','#reviews','#partners','#faq','#contacts','footer']){
   const el=p.locator(selector);if(!await el.count())continue;await el.evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-30,behavior:'instant'}));await p.waitForTimeout(120);
   if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))overflow.push(selector);
  }assert.deepEqual(overflow,[]);
  if(width===390){
   await p.locator('#contacts').screenshot({path:`${out}/request-${width}.png`});await p.evaluate(()=>{document.documentElement.style.fontSize='200%';scrollTo({top:0,behavior:'instant'});});
   await p.locator('.mobile-menu-trigger').tap();await p.waitForTimeout(380);
   const edge=await p.locator('.mobile-menu-close').evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport;return{left:r.left,right:r.right,min:v.offsetLeft,max:v.offsetLeft+v.width};});assert(edge.left>=edge.min-1&&edge.right<=edge.max+1);
   await p.locator('.mobile-menu-close').tap();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);reports.push({width,roofOrder:true,iconsCentered:true,faqMotion:true,rapidToggle:true,keyboard:true,overflow,errors,bad});await p.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(base);await reduced.locator('.faq-item').nth(1).locator('summary').click();assert.equal(await reduced.locator('.faq-answer').evaluateAll(es=>es.reduce((n,e)=>n+e.getAnimations().length,0)),0);await reduced.close();
 const native=await browser.newPage({javaScriptEnabled:false});await native.goto(base);await native.locator('.faq-item').nth(1).locator('summary').click();assert.equal(await native.locator('.faq-item[open]').count(),1);await native.close();
 fs.writeFileSync(`${out}/check.json`,JSON.stringify({base,reports,reduced:true,noJs:true},null,2));console.log(JSON.stringify({base,widths:reports.map(r=>r.width),faq:true,roof:true,icons:true,reduced:true,noJs:true}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
