// NODE_PATH=/path/to/node_modules node _アップロード不要/test-browser.cjs
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const csp=fs.readFileSync(path.join(root,'.htaccess'),'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
(async()=>{
const browser=await chromium.launch({headless:true}),results=[];
// Run the actual animation on the old and new pages, including the dynamically approved image.
for(const width of [1280,390,320])for(const reducedMotion of ['no-preference','reduce']){
 const states=[];
 for(const port of [8765,8766]){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion});const p=await ctx.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'networkidle'});
  await p.locator('.power-scene').scrollIntoViewIfNeeded();await p.waitForTimeout(500);
  await p.locator('.scene-reset').click();await p.locator('.fast-action').click();
  await p.waitForTimeout(reducedMotion==='reduce'?200:3500);
  const state=await p.locator('.power-scene').evaluate(e=>({phase:e.dataset.phase,loaded:e.querySelector('.people-after').naturalWidth>0,before:e.querySelector('.people-before').getAttribute('aria-hidden'),after:e.querySelector('.people-after').getAttribute('aria-hidden')}));
  assert.equal(state.phase,'transformed');assert.equal(state.loaded,true);assert.deepEqual(errors,[]);states.push(state);
  await p.locator('.scene-reset').click();assert.equal(await p.locator('.power-scene').getAttribute('data-phase'),'idle');
  await ctx.close();
 }
 assert.deepEqual(states[0],states[1]);results.push(`animation preserved ${width} ${reducedMotion}`);
}
// Isolated production-origin browser: all external requests are intercepted, never measured or sent.
const ctx=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});const p=await ctx.newPage();let mode='success',posts=0;
const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='challenges.cloudflare.com')return route.fulfill({body:"window.turnstile={render:(e,o)=>{window.tsCallback=o.callback;queueMicrotask(()=>o.callback('verified-token'));return 'widget'},reset:()=>queueMicrotask(()=>window.tsCallback('verified-token')),remove:()=>{},isExpired:()=>false};",contentType:'text/javascript'});
 if(u.hostname!=='ai-fast.jp')return route.fulfill({status:200,body:'',contentType:'application/javascript'});
 if(u.pathname==='/contact.php'){
  if(route.request().method()==='GET')return route.fulfill({json:{ok:true,token:'test-token',siteKey:'0x4AAAAAAFzDHtP2H4_6Y4QX'}});
  posts++;const body=route.request().postDataJSON();assert.equal(body.agree,true);assert.equal(body.email,'test@example.invalid');assert.equal(route.request().headers()['x-csrf-token'],'test-token');
  await new Promise(r=>setTimeout(r,150));
  if(mode==='network')return route.abort();
  if(mode==='failure')return route.fulfill({status:503,json:{ok:false,message:'送信できませんでした。'}});
  return route.fulfill({json:{ok:true,message:'お問い合わせを受け付けました。'}});
 }
 const file=path.join(root,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
 if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
 return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)],headers:{'Content-Security-Policy':csp}});
});
await p.goto('https://ai-fast.jp/');await p.locator('a[data-cta]').filter({hasText:'資料請求'}).first().click();
const form=p.locator('.r47-form');assert.equal(await form.locator('[name=kind]').inputValue(),'doc');
await form.locator('[type=submit]').click();assert.equal(posts,0);
for(const [key,value] of Object.entries({company:'検証会社',family:'検証',given:'太郎',email:'test@example.invalid',tel:'0312345678'}))await form.locator(`[name=${key}]`).fill(value);
await form.locator('[name=agree]').check();
mode='failure';await form.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.done').textContent==='送信できませんでした。');assert.equal(await form.locator('[name=company]').inputValue(),'検証会社');
mode='network';await form.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.done').textContent.includes('送信結果を確認できません'));assert.equal(await form.locator('[name=company]').inputValue(),'検証会社');
mode='success';await form.locator('[type=submit]').click();assert.equal(await form.locator('[type=submit]').isDisabled(),true);await p.waitForFunction(()=>document.querySelector('.done').textContent==='お問い合わせを受け付けました。');assert.equal(await form.locator('[type=submit]').isDisabled(),true);assert.equal(posts,3);
const events=await p.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
assert.equal(events.filter(x=>x[0]==='config'&&x[1]==='G-JTJ5249XSK').length,1);
assert.equal(events.filter(x=>x[0]==='event'&&x[1]==='generate_lead').length,1);
assert.ok(events.some(x=>x[0]==='event'&&x[1]==='cta_click'));
assert.ok(!JSON.stringify(events).includes('test@example.invalid'));assert.ok(!JSON.stringify(events).includes('検証会社'));
await form.locator('.r47-form-x').click();results.push('form: validation, failure, network failure, success, duplicate click prevention, analytics without PII');
await p.goto('https://ai-fast.jp/faq.html');await p.locator('input[type=search]').fill('GIS');await p.waitForTimeout(200);let count=await p.locator('details.faq-item:visible').count();assert.ok(count>0&&count<64);
await p.locator('input[type=search]').fill('zzzz-no-match-zzzz');await p.waitForTimeout(200);assert.equal(await p.locator('details.faq-item:visible').count(),0);
await p.locator('input[type=search]').fill('');await p.locator('button[data-filter="導入・サポート"]').click();count=await p.locator('details.faq-item:visible').count();assert.ok(count>0&&count<64);
await p.locator('details.faq-item:visible summary').first().click();assert.ok(await p.locator('details.faq-item[open]').count());results.push('FAQ search, filtering, opening');
await p.locator('.r42-menu').click();assert.equal(await p.locator('.r42-menu').getAttribute('aria-expanded'),'true');results.push('mobile menu');
assert.deepEqual(errors,[]);await ctx.close();await browser.close();console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
