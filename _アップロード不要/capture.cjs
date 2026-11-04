const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
const phase=process.argv[2], base=process.argv[3], out=process.env.QA_OUTPUT || '/tmp/jusetsu-qa'; fs.mkdirSync(out,{recursive:true});
const pages=['index.html','compare.html','condo.html','start.html','faq.html','features/index.html',...Array.from({length:7},(_,i)=>`features/f0${i+1}.html`)];
const b=await chromium.launch({headless:true}); const results=[];
for(const width of [1280,390,320]) {
 const ctx=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 for(const old of pages){
  const file=phase==='before'?old:old.replace('features/index.html','features.html').replace('features/f0','feature-0');
  const p=await ctx.newPage(), errors=[];
  p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await p.goto(base+'/'+file,{waitUntil:'networkidle'}); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(700);
  // Load lazily loaded images without changing the final comparison position.
  await p.evaluate(async()=>{for(const img of document.images)img.loading='eager'; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  await p.screenshot({path:`${out}/${phase}-${width}-${old.replaceAll('/','_')}.png`,fullPage:true,animations:'disabled'});
  const state=await p.evaluate(()=>({width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight,broken:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.getAttribute('src')),rects:[...document.querySelectorAll('h1,h2,h3,section,header,footer')].map(x=>{const r=x.getBoundingClientRect();return [x.tagName,x.id,r.x,r.y,r.width,r.height]})}));
  results.push({page:old,width,errors,...state});await p.close();
 }
 await ctx.close(); console.log(phase,width,'done');
}
fs.writeFileSync(`${out}/${phase}.json`,JSON.stringify(results,null,2));await b.close();
})();
