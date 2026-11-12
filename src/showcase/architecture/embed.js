import {wheelPixels,canScrollInside} from '../../js/smooth-scroll.js';

// Presentation-wide interaction rule; donor typography and layout stay intact.
const controlsStyle = document.createElement('link');
controlsStyle.rel = 'stylesheet';
controlsStyle.href = new URL('./controls.css', import.meta.url).href;
document.head.append(controlsStyle);

// Keep the excerpt inside its own document and four included sections.
for(const link of document.querySelectorAll('a[href]')){
  const raw=link.getAttribute('href');
  if(link.classList.contains('brand')){link.setAttribute('href','#top');continue;}
  if(raw.startsWith('#')&&document.getElementById(raw.slice(1)))continue;
  if(link.classList.contains('header__cta')){
    link.setAttribute('href','#work');
    if(link.firstChild?.nodeType===Node.TEXT_NODE)link.firstChild.textContent='События в деле ';
    continue;
  }
  if(link.closest('.desktop-nav, .mobile-menu')){link.remove();continue;}
  link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.tabIndex=-1;
}
document.addEventListener('submit',event=>event.preventDefault());
const life=new AbortController();
async function announceReady(){
  await document.fonts.ready;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(life.signal.aborted)return;
    window.frameElement?.dispatchEvent(new parent.CustomEvent('produckta:preview-ready'));
  }));
}
if(document.readyState==='complete')announceReady();
else window.addEventListener('load',announceReady,{once:true,signal:life.signal});
window.addEventListener('wheel',event=>{
  const delta=wheelPixels(event);
  if(!event.cancelable||event.defaultPrevented||!delta)return;
  if(event.target.closest?.('input,textarea,select,[contenteditable],dialog'))return;
  if(canScrollInside(event.target,document.scrollingElement,delta))return;
  if(!window.frameElement)return;
  const request=new parent.CustomEvent('produckta:preview-wheel',{
    detail:{deltaY:delta,deltaMode:event.deltaMode},cancelable:true,
  });
  if(!window.frameElement.dispatchEvent(request)){
    event.preventDefault();event.stopPropagation();
  }
},{capture:true,passive:false,signal:life.signal});
for(const name of ['pointerdown','keydown','touchstart']){
  window.addEventListener(name,()=>{
    window.frameElement?.dispatchEvent(new parent.CustomEvent('produckta:preview-cancel'));
  },{passive:true,signal:life.signal});
}
window.addEventListener('pagehide',event=>{if(!event.persisted)life.abort();},{signal:life.signal});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='producta-preview-visibility')return;
  document.body.classList.toggle('preview-paused',!event.data.visible);
},{signal:life.signal});
