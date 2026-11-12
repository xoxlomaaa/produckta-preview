const {chromium}=require('C:/Users/Павел/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const report={errors:[],http:[],widths:{}};
const out='output/qa/showcase-main-transfer';
fs.mkdirSync(out,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    const health=await(await fetch('http://127.0.0.1:4330/__frontend-health')).json();
    assert.match(health.root,/Produckta[\\/]dist[\\/]?$/);
    report.health=health;
    for(const file of ['src/styles/home.css','src/js/home.js','src/js/smooth-scroll.js']){
      assert.equal(hash(file),hash('output/checkpoints/before-showcase-promotion-2026-11-11/'+file),file+' changed');
    }
    report.approvedPageScrollAndBaseStylesUnchanged=true;
    for(const width of [1920,390]){
      const p=await b.newPage({viewport:{width,height:width>600?1080:844},isMobile:width<600,hasTouch:width<600});
      p.on('pageerror',e=>report.errors.push(e.message));
      p.on('response',r=>{if(r.status()>=400)report.http.push({url:r.url(),status:r.status()});});
      await p.goto('http://127.0.0.1:4330/');
      assert.doesNotMatch(await p.title(),/Эксперимент/);
      assert.equal(await p.locator('#capabilities').count(),1);
      assert.equal(await p.locator('.cap-project').count(),5);
      const order=await p.locator('main>section').evaluateAll(es=>es.map(e=>e.id));
      assert.equal(order[order.indexOf('process')+1],'capabilities');
      assert.equal(order[order.indexOf('capabilities')+1],'about');
      await p.locator('iframe').scrollIntoViewIfNeeded();
      const frame=await(await p.locator('iframe').elementHandle()).contentFrame();
      await frame.waitForSelector('#work');
      await frame.evaluate(()=>document.fonts.ready);
      await p.waitForTimeout(500);
      const box=await p.locator('iframe').boundingBox();
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await frame.evaluate(()=>scrollTo({top:200,behavior:'instant'}));
      const pageY=await p.evaluate(()=>scrollY);
      await p.mouse.wheel(0,315);
      await p.waitForTimeout(800);
      assert.equal(await frame.evaluate(()=>scrollY),515);
      assert.equal(await p.evaluate(()=>scrollY),pageY);
      await frame.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight-innerHeight-100,behavior:'instant'}));
      await p.mouse.wheel(0,315);
      await p.waitForTimeout(850);
      assert(Math.abs(await p.evaluate(()=>scrollY)-pageY-215)<=2);

      if(width===1920){
        const scene=p.locator('[data-showcase-locker]');
        await scene.scrollIntoViewIfNeeded();
        await p.waitForFunction(()=>document.querySelector('[data-showcase-locker]').dataset.revealDistance);
        const release=Number(await scene.getAttribute('data-reveal-distance'));
        await p.evaluate(y=>scrollTo({top:y-160,behavior:'instant'}),release);
        await p.mouse.move(720,450);
        await p.waitForFunction(()=>document.querySelector('[data-showcase-locker]').dataset.renderFrame==='1');
        const frames=[];
        for(let i=0;i<5;i++){
          await p.mouse.wheel(0,315);await p.waitForTimeout(800);
          frames.push(Number(await scene.getAttribute('data-render-frame')));
        }
        assert(frames.at(-1)>=100&&frames.at(-1)<168,'scene should advance less than the previous five-notch reference');
        await p.mouse.wheel(0,-315);await p.waitForTimeout(800);
        const reverse=Number(await scene.getAttribute('data-render-frame'));
        assert(reverse<frames.at(-1));
        report.scene={wheelPace:1.15,previousFiveNotches:[18,61,100,148,168],frames,reverse};
        await p.screenshot({path:out+'/scene-1920.png'});
      }

      await p.locator('[data-roof-demo]').scrollIntoViewIfNeeded();
      await p.waitForFunction(()=>document.querySelector('[data-roof-demo]').dataset.modelReady==='true');
      const sceneBefore=await p.locator('[data-roof-viewport]').boundingBox();
      await p.locator('[data-roof-layers] button').nth(2).click();
      const sceneAfter=await p.locator('[data-roof-viewport]').boundingBox();
      assert.equal(sceneBefore.height,sceneAfter.height);
      await p.locator('[data-roof-explode]').fill('50');
      await p.locator('[data-roof-isolate]').click();
      assert.equal(await p.locator('[data-roof-isolate]').getAttribute('aria-pressed'),'true');
      await p.locator('[data-roof-reset]').click();
      await p.screenshot({path:out+`/roof-${width}.png`});

      await p.locator('[data-admin-reset]').click();
      assert.equal(await p.locator('[data-admin-rows]>li').count(),3);
      await p.locator('[data-rental-action="B-1042"]').click();
      const dialog=p.locator('[data-rental-dialog]');
      await p.waitForTimeout(280);
      assert(await dialog.evaluate(d=>d.open&&!d.matches(':modal')));
      const popupOffset=await dialog.evaluate(d=>{const b=d.getBoundingClientRect(),r=d.closest('.rental').getBoundingClientRect();return b.top+b.height/2-r.top-r.height/2;});
      assert(Math.abs(popupOffset)<2);
      await p.screenshot({path:out+`/rental-${width}.png`});
      await p.locator('[data-rental-submit]').click();
      assert.match(await p.locator('[data-record-id="B-1042"]').innerText(),/В прокате/);
      await p.locator('[data-admin-reset]').click();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      report.widths[width]={oneSection:true,examples:5,order,iframeHandoff:true,roofReady:true,layerHeightStable:true,rentalPopupCentered:true,rentalAction:true,noHorizontalOverflow:true};
      await p.close();
    }
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.http,[]);
    report.passed=true;
  }finally{
    fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
    await b.close();
  }
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
