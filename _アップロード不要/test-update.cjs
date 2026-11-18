const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const csp=fs.readFileSync(path.join(root,'.htaccess'),'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const mock=`window.__challengeAuto=true;window.turnstile={render:(e,o)=>{window.__opts=o;e.textContent='認証テスト';e.style.height='65px';window.__complete=()=>o.callback('verified-token');if(window.__challengeAuto)setTimeout(window.__complete,10);return 'widget';},remove:()=>{},reset:()=>{if(window.__challengeAuto)setTimeout(window.__complete,10)},isExpired:()=>false};`;
(async()=>{const b=await chromium.launch();let results=[];
for(const width of [1280,390,320]){
const ctx=await b.newContext({viewport:{width,height:900},hasTouch:width<500,isMobile:width<500}),p=await ctx.newPage();let posts=0,mode='success',scriptFails=false;const errors=[],missing=[];p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()===404)missing.push(r.url())});
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='challenges.cloudflare.com'){if(scriptFails){scriptFails=false;return route.abort();}return route.fulfill({body:mock,contentType:'text/javascript'});}
 if(u.hostname!=='ai-fast.jp')return route.fulfill({body:'',contentType:'text/javascript'});
 if(u.pathname==='/contact.php'){
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,token:'csrf',siteKey:'0x4AAAAAAFzDHtP2H4_6Y4QX'}});
  const body=route.request().postDataJSON();posts++;assert.equal(body.turnstile_token,'verified-token');assert.equal(body.email,'test@example.invalid');
  await new Promise(r=>setTimeout(r,100));
  if(mode==='failure')return route.fulfill({status:503,json:{ok:false,message:'送信できませんでした。'}});
  if(mode==='network')return route.abort();
  return route.fulfill({json:{ok:true,message:'お問い合わせを受け付けました。'}});
 }
 const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(!fs.existsSync(f))return route.fulfill({status:404,body:''});
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
 await route.fulfill({body:fs.readFileSync(f),contentType:types[path.extname(f)],headers:{'Content-Security-Policy':csp}});
});

for(const file of fs.readdirSync(root).filter(n=>n.endsWith('.html'))){
await p.goto('https://ai-fast.jp/'+file,{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=650){scrollTo(0,y);await new Promise(r=>setTimeout(r,15))}scrollTo(0,0)});await p.waitForTimeout(200);
const bad=await p.locator('img').evaluateAll(es=>es.filter(e=>e.getAttribute('src')&&e.complete&&!e.naturalWidth).map(e=>e.getAttribute('src')));assert.deepEqual(bad,[],file+' broken images');
const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,file+' overflow '+width);
const trigger=p.locator('a[data-cta]:visible').filter({hasText:'資料請求'}).first();await trigger.click();await p.waitForFunction(()=>document.querySelector('.r47-form-dlg')?.open);await p.goBack();await p.waitForFunction(()=>!document.querySelector('.r47-form-dlg')?.open);assert.ok(p.url().endsWith(file),'back should close dialog');
await trigger.click();await p.locator('.r47-form-x').click();await p.waitForTimeout(100);
if(file==='index.html'){
await p.locator('.panel-shell').evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top+350));await p.waitForTimeout(1500);assert.equal(await p.locator('.flip-cell').count(),36);assert.ok((await p.locator('.flip-cell').evaluateAll(es=>es.map(e=>e.style.transform))).some(x=>x!=='rotateX(0deg)'));
await p.locator('.power-scene').scrollIntoViewIfNeeded();await p.locator('.scene-reset').click();await p.locator('.fast-action').click();await p.waitForTimeout(3700);assert.equal(await p.locator('.power-scene').getAttribute('data-phase'),'transformed');
await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'/tmp/jusetsu-qa/update-index-'+width+'.png',fullPage:true});
}
if(file==='faq.html'){assert.equal(await p.locator('details.faq-item').count(),63);await p.locator('input[type=search]').fill('GIS');assert.ok(await p.locator('details.faq-item:visible').count()>0);}
results.push(file+' '+width);
}
assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await ctx.close();}
await b.close();console.log(JSON.stringify({passed:results.length,checks:'13 pages x3 widths; images, overflow, dialog back/close, panel animation, scene animation, FAQ',results},null,2))})().catch(e=>{console.error(e);process.exit(1)});
