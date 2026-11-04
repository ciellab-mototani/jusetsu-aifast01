/* Decorative cue only. Asset approval and timing remain owned by fv-scene.js. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else api.mount(root.document.querySelector('#fv'),root);
})(typeof window!=='undefined'?window:globalThis,function(){
 function geometry(box,fast,team){
  if([box,fast,team].some(r=>!r||![r.left,r.top,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0))return null;
  const sx=fast.left-box.left+fast.width*.5, sy=fast.top-box.top+fast.height*.6;
  return [0.16,0.39,0.62,0.84].map(f=>{
   const x=team.left-box.left+team.width*f,y=team.top-box.top+team.height*.58;
   const lift=Math.min(55,Math.abs(x-sx)*.18);
   return {x,y,r:Math.min(15,team.width*.085),d:`M ${sx} ${sy} Q ${(sx+x)/2} ${Math.min(sy,y)-lift} ${x} ${y}`};
  });
 }
 // Existing images use centered object-fit:contain. Exclude letterbox space.
 function imageRect(el){
  const r=el.getBoundingClientRect();
  if(!(el.naturalWidth>0&&el.naturalHeight>0))return r;
  const scale=Math.min(r.width/el.naturalWidth,r.height/el.naturalHeight),width=el.naturalWidth*scale,height=el.naturalHeight*scale;
  return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};
 }
 function mount(host,win){
  if(!host||host.dataset.magicMounted)return;
  const scene=host.querySelector('.power-scene'),fast=host.querySelector('.fast-action img'),team=host.querySelector('.people-before');
  if(!scene||!fast||!team)return;
  host.dataset.magicMounted='true';
  const ns='http://www.w3.org/2000/svg',svg=win.document.createElementNS(ns,'svg');
  svg.setAttribute('class','magic-delivery');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const rays=[0,1,2,3].map(()=>{
   const path=win.document.createElementNS(ns,'path'),ring=win.document.createElementNS(ns,'circle');
   path.setAttribute('pathLength','1');ring.setAttribute('r','15');svg.append(path,ring);return {path,ring};
  });
  scene.append(svg);let raf=0,dead=false;const off=[];
  function draw(){raf=0;if(dead)return;
   const box=scene.getBoundingClientRect(),g=geometry(box,imageRect(fast),imageRect(team));
   svg.style.visibility=g?'visible':'hidden';if(!g)return;
   svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
   g.forEach((p,i)=>{rays[i].path.setAttribute('d',p.d);rays[i].ring.setAttribute('cx',p.x);rays[i].ring.setAttribute('cy',p.y);rays[i].ring.setAttribute('r',p.r)});
  }
  function queue(){if(!dead&&!raf)raf=win.requestAnimationFrame(draw)}
  function listen(el,type,fn){el.addEventListener(type,fn);off.push(()=>el.removeEventListener(type,fn))}
  const observer=win.ResizeObserver?new win.ResizeObserver(queue):null;
  if(observer)[scene,fast,team].forEach(el=>observer.observe(el));
  listen(win,'resize',queue);[fast,team].forEach(el=>listen(el,'load',queue));
  // Phase changes need no JS work: CSS starts/cancels with the existing state.
  listen(host,'fv-destroy',()=>{dead=true;if(raf)win.cancelAnimationFrame(raf);observer?.disconnect();off.forEach(fn=>fn());svg.remove();delete host.dataset.magicMounted});
  win.document.fonts?.ready.then(queue);queue();
 }
 return {geometry,imageRect,mount};
});
