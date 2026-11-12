export function initArchitecture(root,wheel) {
  const frame=root.querySelector('iframe');
  const shell=frame.closest('.cap-site-shell');
  const life=new AbortController();
  let loaded=false;
  let ready=false;
  let failed=false;
  let loadTimer=0;
  let centred=false;
  frame.setAttribute('aria-busy','true');
  const alignAt=()=>{
    const bounds=shell.getBoundingClientRect();
    return scrollY+bounds.top+(bounds.height-innerHeight)/2;
  };
  const notePosition=()=>{centred=ready&&Math.abs(scrollY-alignAt())<=1;};
  const fit=()=>{
    const keepCentred=centred;
    const scale=Math.min(1,Math.max(1,innerHeight-32)/Math.max(1,shell.offsetHeight));
    shell.style.setProperty('--preview-scale',String(scale));
    if(keepCentred&&ready)window.scrollTo({top:alignAt(),behavior:'instant'});
    notePosition();
  };
  fit();
  window.addEventListener('resize',fit,{passive:true,signal:life.signal});
  window.addEventListener('scroll',notePosition,{passive:true,signal:life.signal});
  document.fonts.ready.then(()=>{if(!life.signal.aborted)fit();});
  wheel.registerPreview(()=>failed?null:{view:frame.contentWindow,ready,alignAt:alignAt()},life.signal);
  const finish=(success)=>{
    clearTimeout(loadTimer);
    ready=success;
    failed=!success;
    frame.dataset.scrollReady=String(success);
    frame.setAttribute('aria-busy','false');
    notePosition();
    wheel.refreshPreviews();
  };
  frame.addEventListener('produckta:preview-ready',()=>finish(true),{signal:life.signal});
  frame.addEventListener('error',()=>finish(false),{signal:life.signal});
  frame.addEventListener('load',()=>{
    if(!loaded)return;
    try{
      const doc=frame.contentDocument;
      if(doc?.URL==='about:blank')return;
      if(!doc?.querySelector('script[src$="embed.js"]'))finish(false);
    }catch{finish(false);}
  },{signal:life.signal});
  const observer=new IntersectionObserver(([entry])=>{
    if(entry.isIntersecting&&!loaded){
      loaded=true;
      frame.setAttribute('aria-busy','true');
      loadTimer=setTimeout(()=>finish(false),12000);
      frame.src=frame.dataset.src;
    }
    if(loaded)frame.contentWindow?.postMessage({type:'producta-preview-visibility',visible:entry.isIntersecting},location.origin);
  },{rootMargin:'1000px'});
  observer.observe(root);
  // A synchronous, frame-local event acknowledges ownership before the browser
  // scrolls. The child and page then use the exact same parent-owned animation.
  frame.addEventListener('produckta:preview-wheel',event=>{
    const {deltaY,deltaMode}=event.detail||{};
    if(wheel.scrollBy(deltaY,{nested:frame.contentWindow,deltaMode,alignAt:alignAt()}))event.preventDefault();
  },{signal:life.signal});
  frame.addEventListener('produckta:preview-cancel',()=>wheel.cancel(),{signal:life.signal});
  return ()=>{clearTimeout(loadTimer);observer.disconnect();life.abort();};
}
