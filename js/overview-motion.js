/* Original LP: nearest explanation center selects its corresponding screen.
   No scroll hijacking; overview only. CommonJS export exists solely for tests. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory;else{const api=factory(window,document);api.init();window.addEventListener('pagehide',api.destroy);window.addEventListener('pageshow',api.init);document.querySelector('#reinitialize')?.addEventListener('click',api.init);}})(function(win,doc){
 let dispose=null;
 function nearest(rects,line){let selected=-1,distance=Infinity;rects.forEach((r,i)=>{const d=Math.abs(r.top+r.height/2-line);if(d<distance){distance=d;selected=i;}});return selected;}
 function destroy(){if(dispose){dispose();dispose=null;}}
 function init(){destroy();const root=doc.querySelector('#workflow-overview');if(!root)return;
  const items=[...root.querySelectorAll('[data-overview-step]')],frames=[...root.querySelectorAll('.overview-device [data-screen]')];
  if(items.length!==frames.length||!items.length)return;
  const media=win.matchMedia('(prefers-reduced-motion: no-preference)');let raf=0,dead=false;
  const removes=[];function on(n,type,fn){n.addEventListener(type,fn,{passive:true});removes.push(()=>n.removeEventListener(type,fn));}
  function cancel(){if(raf)win.cancelAnimationFrame(raf);raf=0;}
  function reset(){delete root.dataset.motion;items.forEach(n=>n.classList.remove('is-active'));frames.forEach(n=>n.classList.remove('is-active'));}
  function update(){raf=0;if(dead||doc.hidden)return;if(!media.matches){reset();return;}root.dataset.motion='scroll';
   const index=nearest(items.map(n=>n.getBoundingClientRect()),win.innerHeight/2);
   items.forEach((n,i)=>n.classList.toggle('is-active',i===index));frames.forEach((n,i)=>n.classList.toggle('is-active',i===index));
  }
  function schedule(){if(dead||doc.hidden||raf)return;raf=win.requestAnimationFrame(update);}
  on(win,'scroll',schedule);on(win,'resize',schedule);on(media,'change',()=>{cancel();update();});
  on(doc,'visibilitychange',()=>{cancel();if(!doc.hidden)schedule();});
  root.querySelectorAll('img').forEach(img=>{on(img,'load',schedule);on(img,'error',schedule);});
  const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;items.forEach(n=>observer?.observe(n));
  doc.fonts?.ready.then(()=>{if(!dead)schedule();});
  dispose=()=>{dead=true;cancel();removes.forEach(fn=>fn());observer?.disconnect();reset();};update();
 }
 return {init,destroy,nearest};
});
