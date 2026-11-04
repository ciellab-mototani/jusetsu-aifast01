/* r15: explicit resume after interruption; no automatic replay on return.
   panel-destroy removes panels only; fv-destroy removes panels and scene wiring. */
((page)=>{
 const host=page.querySelector('#fv');if(!host||host.dataset.sceneMounted)return;
 const scene=host.querySelector('.power-scene');if(!scene)return;
 host.dataset.sceneMounted='true';
 const off=[];function listen(node,type,fn){node.addEventListener(type,fn);off.push(()=>node.removeEventListener(type,fn));}
 const go=scene.querySelector('.fast-action'),reset=scene.querySelector('.scene-reset'),message=scene.querySelector('.reaction');
 const label=go.querySelector('span'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let timers=[],busy=false,destroyed=false,trigger=null;
 const before=scene.querySelector('.people-before'),after=scene.querySelector('.people-after');let material='missing';
 // Only an explicitly confirmed local asset may be connected. No substitute image.
 const approvedSrc=after?.dataset.approvedSrc;
 if(after?.dataset.approval==='approved'&&approvedSrc&&/^img\/fv-assets-[A-Za-z0-9_.-]+$/.test(approvedSrc)){
  material='loading';
  listen(after,'load',async()=>{try{if(after.decode)await Promise.race([after.decode(),new Promise(r=>setTimeout(r,400))]);}catch{}if(destroyed)return;material=after.naturalWidth>0?'ready':'failed';after.hidden=material!=='ready';semantics();});
  listen(after,'error',()=>{if(destroyed)return;material='failed';after.hidden=true;restore();});after.src=approvedSrc;
 }
 function semantics(){const changed=scene.dataset.phase==='transforming'||scene.dataset.phase==='transformed';before?.setAttribute('aria-hidden',String(changed));after?.setAttribute('aria-hidden',String(!changed));}
 function phase(value){scene.dataset.phase=value;semantics();}
 function clear(){timers.forEach(clearTimeout);timers=[];busy=false;}
 function setLabel(text){if(label)label.textContent=text;go.setAttribute('aria-label',text);}
 function restore(){clear();phase('idle');message.textContent='ファストが、仕事を支える力に。';setLabel('ここをタップしてみてください');}
 function finish(){
  if(material!=='ready'){clear();phase('awaiting-material');message.textContent=material==='loading'?'変身画像を準備中です。準備後にタップして再生してください。':material==='failed'?'変身画像を読み込めませんでした。元の4人を表示しています。':'ファストの合図を表示しました。';setLabel('もう一度、合図を見る');return;}
  phase(reduced.matches?'transformed':'transforming');
  message.textContent='重説AIファストで、パワーアップ！';
  if(reduced.matches){clear();setLabel('もう一度、変化を見る');return;}
  timers.push(setTimeout(()=>{clear();phase('transformed');setLabel('もう一度、変化を見る');},700));
 }
 function pause(){if(!busy)return;clear();phase('paused');message.textContent='演出を一時停止しました。タップで最初から再開できます。';setLabel('タップして演出を再開');}
 function play(){if(destroyed||busy)return;clear();busy=true;phase('activate');message.textContent='重説AIファストで、パワーアップ！';setLabel('AI支援の合図を表示中');if(reduced.matches){finish();return;}timers.push(setTimeout(()=>{phase('support');},900),setTimeout(finish,2600));}
 listen(go,'click',play);
 listen(scene,'panel-complete',()=>{if(scene.dataset.phase==='idle')play();});
 listen(scene,'panel-reset',restore);listen(reset,'click',restore);
 listen(page,'keydown',e=>{if(e.key==='Escape')restore();});
 listen(page,'visibilitychange',()=>{if(page.hidden)pause();});
 listen(window,'pagehide',pause);
 const observer=new IntersectionObserver(es=>{if(!es[0].isIntersecting)pause();},{threshold:0});observer.observe(scene);
 listen(reduced,'change',()=>{if(reduced.matches&&busy){clear();finish();}});
 const dialog=host.querySelector('dialog');
 host.querySelectorAll('[data-contact]').forEach(button=>listen(button,'click',()=>{trigger=button;dialog.querySelector('h2').textContent=button.dataset.contact;if(!dialog.open)dialog.showModal();}));
 listen(dialog.querySelector('button'),'click',event=>{if(event.detail>1)return;dialog.close();});
 listen(dialog,'close',()=>{if(!destroyed)trigger?.focus();});
 listen(host,'fv-destroy',()=>{
  destroyed=true;clear();observer.disconnect();
  host.querySelector('.hero')?.dispatchEvent(new Event('panel-destroy'));
  off.forEach(remove=>remove());if(dialog.open)dialog.close();
  delete host.dataset.sceneMounted;
 });
 restore();
})(document);
