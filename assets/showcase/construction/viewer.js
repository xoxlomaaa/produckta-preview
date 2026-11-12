import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {downloadRoof} from '../roof-download.js';
const LEVELS={'9':0,'8':1,'7':2,'6':3,'5':3,'4':4,'3':5,'2':6,'1':7};
const NORMAL=new THREE.Vector3(0,Math.cos(35*Math.PI/180),Math.sin(35*Math.PI/180));
// Anchors are on exposed material, stored in glTF Y-up coordinates.
const PIN_ANCHORS={'1':[-.85,.365,-.75],'2':[.5,.321,.59],'3':[.6,.295,-.30],'4':[.78,.243,.08],'5':[-.90,.236,1.20],'6':[1.20,.237,.80],'7':[.90,.086,1.30],'8':[1.27,.032,.9],'9':[0,.026,1.69]};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export class SystemViewer extends EventTarget {
 constructor(host){
  super();this.host=host;this.groups=new Map();this.bases=new Map();this.materials=new Set();this.ready=false;this.selected='5';this.explode=0;this.explodeTarget=0;this.isolated=false;this.dirty=true;this.disposed=false;
  const mobile=matchMedia('(max-width:760px)').matches;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:mobile?'low-power':'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NeutralToneMapping;this.renderer.toneMappingExposure=1.05;
  this.renderer.shadowMap.enabled=false;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  host.append(this.renderer.domElement);this.pin=document.createElement('div');this.pin.className='model-pin';this.pin.setAttribute('aria-hidden','true');this.pin.hidden=true;host.append(this.pin);this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(37,1,.025,150);this.camera.position.set(7,6,9);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.1;this.controls.enablePan=false;this.controls.minDistance=.6;this.controls.maxDistance=32;this.controls.minPolarAngle=.025;this.controls.maxPolarAngle=Math.PI*.88;
  this.controls.addEventListener('start',()=>this.transition=null);this.controls.addEventListener('change',()=>{this.dirty=true;clearTimeout(this.cameraTimer);this.cameraTimer=setTimeout(()=>this.emitCamera(),160);});this.controls.addEventListener('end',()=>this.emitCamera());
  const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04).texture;this.scene.environment=this.env;this.scene.environmentIntensity=.42;room.dispose();pmrem.dispose();
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x99988a,.5));
  const light=new THREE.DirectionalLight(0xfff7ee,2.4);light.position.set(-3.8,7,4.5);light.castShadow=false;light.shadow.mapSize.set(2048,2048);light.shadow.radius=5;light.shadow.camera.left=-6;light.shadow.camera.right=6;light.shadow.camera.top=7;light.shadow.camera.bottom=-6;light.shadow.camera.far=25;light.shadow.bias=-.00008;light.shadow.normalBias=.006;this.scene.add(light);
  const fill=new THREE.DirectionalLight(0xf2f6ff,.45);fill.position.set(6,4,-4);this.scene.add(fill);
  this.floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.ShadowMaterial({opacity:.065}));this.floor.rotation.x=-Math.PI/2;this.floor.position.y=.094;this.floor.receiveShadow=true;this.scene.add(this.floor);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=512;shadowCanvas.height=512;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(256,256,16,256,256,250);gradient.addColorStop(0,'rgba(39,48,30,.9)');gradient.addColorStop(.5,'rgba(39,48,30,.5)');gradient.addColorStop(1,'rgba(39,48,30,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(4.7,4.7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,opacity:.065,depthWrite:false,toneMapped:false}));this.contactShadow.rotation.x=-Math.PI/2;this.contactShadow.position.y=.095;this.scene.add(this.contactShadow);
  this.selection=new THREE.Box3Helper(new THREE.Box3(),0xc76824);this.selection.material.transparent=true;this.selection.material.opacity=.2;this.selection.visible=false;this.scene.add(this.selection);
  this.ray=new THREE.Raycaster();let start;
  this.onDown=e=>{start={x:e.clientX,y:e.clientY,time:performance.now()};};
  this.onUp=e=>{if(!this.ready||!start||performance.now()-start.time>800||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const rect=host.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);const hit=this.ray.intersectObject(this.root,true).find(h=>this.visible(h.object));if(hit){let o=hit.object;while(o&&!o.userData.layerId)o=o.parent;if(o)this.dispatchEvent(new CustomEvent('select',{detail:String(o.userData.layerId)}));}};
  host.addEventListener('pointerdown',this.onDown);host.addEventListener('pointerup',this.onUp);
  this.onKey=e=>{if(!this.ready)return;const k=e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(k)){e.preventDefault();if(k==='0'){this.dispatchEvent(new Event('reset'));return;}if(['+','=','-'].includes(k)){this.zoom(k==='-'?1.15:1/1.15);return;}this.transition=null;const offset=this.camera.position.clone().sub(this.controls.target),s=new THREE.Spherical().setFromVector3(offset);s.theta+=k==='ArrowLeft'?.13:k==='ArrowRight'?-.13:0;s.phi=THREE.MathUtils.clamp(s.phi+(k==='ArrowUp'?-.1:k==='ArrowDown'?.1:0),.03,Math.PI*.88);this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();this.emitCamera();this.dirty=true;}};
  host.addEventListener('keydown',this.onKey);
  this.onLost=e=>{e.preventDefault();this.ready=false;this.dispatchEvent(new CustomEvent('error',{detail:'Графический контекст потерян. Повторно откройте модель; информация о слоях остаётся доступна.'}));};
  this.renderer.domElement.addEventListener('webglcontextlost',this.onLost);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();this.animate();
 }
 visible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
 resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.size={width,height};const previous=this.camera.aspect;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);if(this.ready&&Math.abs(Math.log(previous/this.camera.aspect))>.28)this.fit(false);this.dirty=true;}
 async load(url,onProgress,signal,expectedBytes=0,prefetchedBytes=null){
  this.draco=new DRACOLoader();this.draco.setDecoderPath('/showcase/vendor/three/addons/libs/draco/gltf/');this.draco.setWorkerLimit(2);
  this.draco.preload();
  const loader=new GLTFLoader();loader.setDRACOLoader(this.draco);
  const bytes=prefetchedBytes||await downloadRoof(url,expectedBytes,onProgress,signal);
  if(signal?.aborted)throw new DOMException('Отменено','AbortError');
  onProgress(.92);
  const gltf=await loader.parseAsync(bytes.buffer,'/showcase/construction/models/');
  if(signal?.aborted||this.disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();});throw new DOMException('Отменено','AbortError');}
  this.preparing=true;this.root=gltf.scene;this.scene.add(this.root);this.root.traverse(o=>{
   if(o.userData.layerId&&o.name.startsWith('Layer_')){const id=String(o.userData.layerId);this.groups.set(id,o);this.bases.set(id,o.position.clone());}
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.side=THREE.DoubleSide;m.envMapIntensity=.7;if(m.transparent){m.depthWrite=false;m.forceSinglePass=true;}if(!this.materials.has(m)){m.userData.originalEmissive=m.emissive?.clone();m.userData.originalEmissiveIntensity=m.emissiveIntensity;this.materials.add(m);}}}
  });
  if(this.groups.size!==9)throw new Error('В файле не найдены все 9 слоёв.');

  this.root.updateMatrixWorld(true);await this.renderer.compileAsync(this.scene,this.camera);
  if(signal?.aborted||this.disposed)throw new DOMException('Отменено','AbortError');
  this.preparing=false;this.ready=true;this.select(this.selected);this.fit(false);this.host.dataset.modelReady='true';onProgress(1);this.draco.dispose();this.dirty=true;
 }
 emitCamera(){if(this.ready)this.dispatchEvent(new CustomEvent('camera',{detail:this.getCamera()}));}
 getCamera(){return {position:this.camera.position.toArray(),target:this.controls.target.toArray(),aspect:this.camera.aspect};}
 restoreCamera(c){if(!c||!this.ready)return;this.transition=null;this.controls.update();this.camera.position.fromArray(c.position);this.controls.target.fromArray(c.target);this.controls.update();if(Math.abs(Math.log(c.aspect/this.camera.aspect))>.3)this.fit(false);this.dirty=true;}
 select(id){if(!this.groups.has(id)&&this.ready)return;const changed=this.selected!==id;this.selected=id;if(!this.ready)return;if(this.isolated)this.setIsolation(true);this.host.dataset.focusLayer=id;this.host.dataset.focusSettled='true';if(changed){this.pin.getAnimations().forEach(a=>a.cancel());if(!reduced())this.pin.animate([{opacity:.25},{opacity:1}],{duration:420,easing:'ease-out'});}this.updateSelection();this.dirty=true;}
 updateSelection(){if(!this.ready)return;const group=this.groups.get(this.selected);this.root.updateMatrixWorld(true);this.selection.box.setFromObject(group);this.selection.visible=false;this.dirty=true;}
 shift(id){return LEVELS[id]*.16*this.explode;}
 applyExplode(){if(!this.ready)return;for(const [id,g]of this.groups){g.position.copy(this.bases.get(id));const parentNormal=NORMAL.clone().transformDirection(g.parent.matrixWorld.clone().invert());g.position.addScaledVector(parentNormal,this.shift(id));}this.root.updateMatrixWorld(true);this.updateSelection();this.host.dataset.explodeSettled=Math.abs(this.explode-this.explodeTarget)<.001?'true':'false';this.dirty=true;}
 setExplode(value,instant=false){this.explodeTarget=Math.min(1,Math.max(0,value));this.explodeMotion={from:this.explode,start:performance.now(),duration:440};if(instant||reduced()){this.explodeMotion=null;this.explode=this.explodeTarget;this.applyExplode();}this.dirty=true;}
 setIsolation(value){this.isolated=value;for(const [id,g]of this.groups)g.visible=!value||id===this.selected;this.floor.visible=!value;this.contactShadow.visible=!value;this.host.dataset.visibleLayers=[...this.groups].filter(([,g])=>g.visible).map(([id])=>id).join(',');this.updateSelection();this.dirty=true;}
 bounds(group){return new THREE.Box3().setFromObject(group||(this.isolated?this.groups.get(this.selected):this.root));}
 distance(box,factor=1,direction){const dir=direction||this.camera.position.clone().sub(this.controls.target).normalize(),right=new THREE.Vector3().crossVectors(this.camera.up,dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize(),center=box.getCenter(new THREE.Vector3()),tanV=Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2),tanH=tanV*this.camera.aspect;let distance=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(dir);distance=Math.max(distance,depth+Math.abs(p.dot(right))/tanH,depth+Math.abs(p.dot(up))/tanV);}return Math.max(.6,distance*factor);}
 move(position,target,animated=true){this.transition={fromPosition:this.camera.position.clone(),fromTarget:this.controls.target.clone(),position,target,start:performance.now(),duration:animated&&!reduced()?550:0};this.dirty=true;}
 fit(animated=true){if(!this.ready)return;const box=this.bounds(),target=box.getCenter(new THREE.Vector3()),dir=new THREE.Vector3(7,6,9).normalize();this.move(target.clone().addScaledVector(dir,this.distance(box,1.12,dir)),target,animated);}
 preset(name){if(!this.ready)return;const box=this.bounds(),target=box.getCenter(new THREE.Vector3()),dirs={perspective:[7,6,9],front:[0,.14,1],top:[0,Math.cos(35*Math.PI/180),Math.sin(35*Math.PI/180)]};const dir=new THREE.Vector3(...(dirs[name]||dirs.perspective)).normalize();this.move(target.clone().addScaledVector(dir,this.distance(box,1.12,dir)),target);}
 focus(){if(!this.ready)return;const box=this.bounds(this.groups.get(this.selected)),target=box.getCenter(new THREE.Vector3()),dir=this.camera.position.clone().sub(this.controls.target).normalize();this.move(target.clone().addScaledVector(dir,this.distance(box,1.15,dir)),target);}
 zoom(factor){if(!this.ready)return;const offset=this.camera.position.clone().sub(this.controls.target);const length=THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance);offset.setLength(length);this.move(this.controls.target.clone().add(offset),this.controls.target.clone());}
 snapshot(){if(!this.ready)return;this.selection.visible=false;this.floor.visible=false;this.contactShadow.visible=false;this.renderer.setClearAlpha(0);this.renderer.render(this.scene,this.camera);const data=this.renderer.domElement.toDataURL('image/png');this.floor.visible=!this.isolated;this.contactShadow.visible=!this.isolated;this.updateSelection();this.dirty=true;return data;}
 updatePin(){const group=this.groups.get(this.selected);if(!group)return;const anchor=group.userData.pinAnchor||PIN_ANCHORS[this.selected],point=group.localToWorld(new THREE.Vector3(...anchor));point.project(this.camera);this.pin.hidden=!this.ready||point.z<-1||point.z>1||Math.abs(point.x)>.95||Math.abs(point.y)>.95;if(!this.pin.hidden){this.pin.textContent=this.selected.padStart(2,'0');this.pin.style.transform=`translate(${(point.x+1)*this.size.width/2-14}px,${(1-point.y)*this.size.height/2-53}px)`;}}
 animate(){if(this.disposed)return;if(this.paused)return;this.frame=requestAnimationFrame(()=>this.animate());if(!this.ready){if(this.dirty&&!this.preparing){this.renderer.render(this.scene,this.camera);this.dirty=false;}return;}
  if(this.explodeMotion){const t=this.explodeMotion,a=reduced()?1:Math.min(1,(performance.now()-t.start)/t.duration),e=1-Math.pow(1-a,3);this.explode=THREE.MathUtils.lerp(t.from,this.explodeTarget,e);this.applyExplode();if(a===1)this.explodeMotion=null;}
  if(this.transition){const t=this.transition,a=t.duration?Math.min(1,(performance.now()-t.start)/t.duration):1,e=a*a*(3-2*a);this.camera.position.lerpVectors(t.fromPosition,t.position,e);this.controls.target.lerpVectors(t.fromTarget,t.target,e);this.dirty=true;if(a===1){this.transition=null;this.emitCamera();}}
  const change=this.controls.update();if((this.dirty||change)&&this.host.clientWidth){this.renderer.render(this.scene,this.camera);this.updatePin();this.dirty=false;}
 }
 pause(){this.paused=true;cancelAnimationFrame(this.frame);}
 resume(){if(this.disposed)return;this.paused=false;this.dirty=true;cancelAnimationFrame(this.frame);this.animate();}
 dispose(){this.disposed=true;this.ready=false;clearTimeout(this.cameraTimer);cancelAnimationFrame(this.frame);this.observer.disconnect();this.controls.dispose();this.host.removeEventListener('pointerdown',this.onDown);this.host.removeEventListener('pointerup',this.onUp);this.host.removeEventListener('keydown',this.onKey);this.renderer.domElement.removeEventListener('webglcontextlost',this.onLost);this.scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});this.draco?.dispose();this.env.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.pin.remove();delete this.host.dataset.modelReady;}
}
