const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Павел/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const base=process.env.CHECK_URL||'http://127.0.0.1:4330/',width=Number(process.env.CHECK_WIDTH||390);
const out='output/qa/roof-loading';fs.mkdirSync(out,{recursive:true});
const label=process.argv[2]||'check';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width,height:width<700?844:1080},isMobile:width<700,hasTouch:width<700,deviceScaleFactor:width<700?2:1});
 const errors=[],bad=[],models=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});if(/\/models\/.*\.glb/.test(r.url()))models.push(r.url());});
 await page.route('**/showcase/construction/viewer.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('super();','super();window.__roofViewer=this;')});});
 await page.addInitScript(()=>{window.roofTasks=[];new PerformanceObserver(l=>roofTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(process.env.CHECK_SLOW==='1'){await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1125000,uploadThroughput:375000,connectionType:'cellular4g'});}
 await page.goto(base,{waitUntil:'load'});
 assert.equal(models.length,0,'Model loaded on the first screen');
 const start=Date.now(),perfStart=await page.evaluate(()=>performance.now());
 await page.locator('[data-roof-viewport]').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-100,behavior:'instant'}));
 await page.waitForSelector('[data-roof-viewport][data-model-ready="true"]',{timeout:120000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const readyMs=Date.now()-start;
 await page.waitForTimeout(500);
 const original=await page.evaluate(()=>{
   const v=__roofViewer;window.renderDurations=[];const render=v.renderer.render.bind(v.renderer);v.renderer.render=(...args)=>{const start=performance.now();const result=render(...args);renderDurations.push(performance.now()-start);return result;};
   const textures=new Set();v.root.traverse(o=>{for(const m of (o.material?(Array.isArray(o.material)?o.material:[o.material]):[]))for(const x of Object.values(m))if(x?.isTexture)textures.add(x);});
   return {camera:v.getCamera(),layers:v.groups.size,render:{...v.renderer.info.render},textures:[...textures].map(t=>({width:t.image?.width,height:t.image?.height})),pixelRatio:v.renderer.getPixelRatio()};
 });
 await page.screenshot({path:`${out}/${label}-${width}-initial.png`});
 await page.locator('[data-roof-explode]').evaluate(e=>{e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>Math.round(__roofViewer.explode*100)),100);
 await page.screenshot({path:`${out}/${label}-${width}-exploded.png`});
 for(let id=1;id<=9;id++){
   await page.locator(`[data-roof-layers] [data-layer="${id}"]`).evaluate(e=>e.click());
   assert.equal(await page.evaluate(()=>__roofViewer.selected),String(id));
 }
 await page.locator('[data-roof-isolate]').evaluate(e=>e.click());
 assert.equal(await page.evaluate(()=>[...__roofViewer.groups.values()].filter(g=>g.visible).length),1);
 await page.locator('[data-roof-zoom="in"]').evaluate(e=>e.click());await page.waitForTimeout(600);
 assert(await page.evaluate(()=>__roofViewer.camera.position.distanceTo(__roofViewer.controls.target)>0));
 await page.locator('[data-roof-reset]').evaluate(e=>e.click());await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>__roofViewer.isolated),false);assert.equal(await page.evaluate(()=>__roofViewer.explodeTarget),0);assert.equal(await page.evaluate(()=>__roofViewer.selected),'5');
 // Exercise actual OrbitControls drag, then keyboard control and snapshot.
 if(width<700)await page.locator('[data-roof-touch]').evaluate(e=>e.click());
 await page.locator('[data-roof-viewport]').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-70,behavior:'instant'}));
 const box=await page.locator('[data-roof-viewport]').boundingBox();const point={x:box.x+box.width*.5,y:box.y+Math.min(box.height*.4,300)};
 const beforeDrag=await page.evaluate(()=>__roofViewer.getCamera());
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+60,point.y+20,{steps:8});await page.mouse.up();await page.waitForTimeout(350);
 const afterDrag=await page.evaluate(()=>__roofViewer.getCamera());assert.notDeepEqual(afterDrag.position,beforeDrag.position);
 if(width<700){
   const beforeTouch=await page.evaluate(()=>__roofViewer.getCamera().position);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+50*i/8,y:point.y+20*i/8,id:1}]});await page.waitForTimeout(16);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
   assert.notDeepEqual(await page.evaluate(()=>__roofViewer.getCamera().position),beforeTouch);
 }
 await page.locator('[data-roof-viewport]').focus();await page.keyboard.press('ArrowLeft');
 assert.notDeepEqual(await page.evaluate(()=>__roofViewer.getCamera().position),afterDrag.position);
 assert(await page.evaluate(()=>__roofViewer.snapshot().startsWith('data:image/png')));
 if(width<700){await page.keyboard.press('Escape');assert.equal(await page.locator('[data-roof-touch]').getAttribute('aria-pressed'),'false');}
 const idleStart=await page.evaluate(()=>__roofViewer.renderer.info.render.frame);await page.waitForTimeout(600);
 const metrics=await page.evaluate(({perfStart,idleStart})=>({
   idleRenders:__roofViewer.renderer.info.render.frame-idleStart,
   longTasks:roofTasks.filter(t=>t.start>=perfStart),renderDurations,
   modelTiming:performance.getEntriesByType('resource').filter(e=>/\/models\/.*\.glb/.test(e.name)).map(e=>({url:e.name,bytes:e.encodedBodySize,duration:e.duration})),
   backgroundPacks:performance.getEntriesByType('resource').filter(e=>/\/render-v3\/.*\.bin/.test(e.name)).length,
   overflow:document.documentElement.scrollWidth>innerWidth,
 }),{perfStart,idleStart});
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);assert(await page.evaluate(()=>__roofViewer.paused));
 const report={base,width,slow:process.env.CHECK_SLOW==='1',readyMs,original,...metrics,models,errors,bad,interactive:true};
 fs.writeFileSync(`${out}/${label}-${width}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,longTasks:undefined,renderDurations:undefined},null,2));assert.equal(errors.length,0);assert.equal(bad.length,0);assert.equal(metrics.overflow,false);assert.equal(models.length,1,'Model requested more than once');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
