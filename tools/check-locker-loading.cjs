// Focused cold-cache scene check; PLAYWRIGHT_MODULE can point at a local install.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Павел/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.CHECK_URL || 'http://127.0.0.1:4330/';
const out='output/qa/locker-loading';fs.mkdirSync(out,{recursive:true});
const label=process.argv[2]||'check',width=Number(process.env.CHECK_WIDTH||1920);
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width,height:width<600?844:1080},hasTouch:width<600,isMobile:width<600});
    const errors=[],bad=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});});
    page.on('request',r=>{if(/render-v[123]/.test(r.url()))requests.push(r.url());});
    const cdp=await page.context().newCDPSession(page);
    if(process.env.CHECK_PROFILE==='1'){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    if(process.env.CHECK_SLOW==='1'){
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:Number(process.env.CHECK_LATENCY||40),downloadThroughput:Number(process.env.CHECK_MIB||4)*1024*1024,uploadThroughput:1024*1024});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    }
    await page.goto(base,{waitUntil:'load'});
    const lead=Number(process.env.CHECK_LEAD||0);
    if(lead)await page.waitForTimeout(lead);
    const scene=page.locator('[data-showcase-locker]');
    await scene.evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-innerHeight+100,behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('[data-showcase-locker]').dataset.revealDistance);
    const start=await scene.evaluate(e=>Number(e.dataset.revealDistance)-Math.max(64,Math.min(136,(innerHeight-(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0))*.13)));
    await page.evaluate(y=>scrollTo({top:y-30,behavior:'instant'}),start);
    const waitStart=Date.now();
    await page.waitForFunction(()=>Number(document.querySelector('[data-showcase-locker]').dataset.renderFrame)>0,{}, {timeout:60000});
    const posterWaitMs=Date.now()-waitStart;
    await page.evaluate(()=>{
      window.sceneTrace=[];let active=true;window.stopSceneTrace=()=>active=false;
      function sample(t){if(!active)return;const e=document.querySelector('[data-showcase-locker]');sceneTrace.push({t,frame:Number(e.dataset.renderFrame),target:Number(e.dataset.renderTarget),y:scrollY});requestAnimationFrame(sample);}requestAnimationFrame(sample);
    });
    await page.mouse.move(80,100);
    for(let i=0;i<34;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(90);}
    await page.waitForTimeout(600);
    const forward=await scene.evaluate(e=>({frame:Number(e.dataset.renderFrame),target:Number(e.dataset.renderTarget)}));
    await page.screenshot({path:`${out}/${label}-${width}-forward.png`});
    for(let i=0;i<34;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(90);}
    await page.waitForTimeout(600);
    const trace=await page.evaluate(()=>{stopSceneTrace();return sceneTrace;});
    if(process.env.CHECK_PROFILE==='1'){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(`${out}/${label}-${width}-profile.json`,JSON.stringify(profile));}
    const reverse=trace.at(-1),changes=[];let prev=trace[0];
    for(const item of trace){if(item.frame!==prev.frame){if(prev.frame!==prev.target&&item.frame>5&&item.frame<255)changes.push({gap:item.t-prev.t,step:Math.abs(item.frame-prev.frame),lag:Math.abs(item.target-item.frame)});prev=item;}}
    const timing=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/render-v[123]/.test(e.name)).map(e=>({url:e.name,bytes:e.encodedBodySize,duration:e.duration})));
    const report={base,width,slow:process.env.CHECK_SLOW==='1',mib:Number(process.env.CHECK_MIB||4),latency:Number(process.env.CHECK_LATENCY||40),lead,posterWaitMs,forward,reverse,maxGap:Math.max(0,...changes.map(x=>x.gap)),stalls:changes.filter(x=>x.gap>100).length,maxStep:Math.max(0,...changes.map(x=>x.step)),requests:requests.length,uniqueRequests:new Set(requests).size,bytes:timing.reduce((s,r)=>s+r.bytes,0),errors,bad,trace,timing};
    fs.writeFileSync(`${out}/${label}-${width}.json`,JSON.stringify(report,null,2));
    console.log(JSON.stringify({...report,trace:undefined,timing:undefined},null,2));
    assert.equal(errors.length,0);assert.equal(bad.length,0);
    if(process.env.CHECK_ASSERT==='1'){
      assert(Math.abs(forward.target-forward.frame)<=3,'Forward motion did not reach the scroll target');
      assert(Math.abs(reverse.target-reverse.frame)<=3,'Reverse motion did not reach the scroll target');
      assert.equal(report.stalls,0,'Visible motion stalled for more than 100 ms');
      assert(report.maxStep<=3,'The source-frame step changed');
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
