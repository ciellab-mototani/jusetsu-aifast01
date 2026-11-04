const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const csp=fs.readFileSync(path.join(root,'.htaccess'),'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const mock=`window.__challengeAuto=true;window.turnstile={render:(e,o)=>{window.__opts=o;e.textContent='認証テスト';e.style.height='65px';window.__complete=()=>o.callback('verified-token');if(window.__challengeAuto)setTimeout(window.__complete,10);return 'widget';},remove:()=>{},reset:()=>{if(window.__challengeAuto)setTimeout(window.__complete,10)},isExpired:()=>false};`;
(async()=>{const b=await chromium.launch(),results=[];
for(const width of [1280,390,320]){
const ctx=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await ctx.newPage();let posts=0,mode='success',scriptFails=width===320;
const errors=[];p.on('pageerror',e=>errors.push(String(e)));
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
await p.goto('https://ai-fast.jp/');await p.locator('a[data-cta]:visible').filter({hasText:'資料請求'}).first().click();const f=p.locator('.r47-form');
if(width===320){await p.waitForFunction(()=>document.querySelector('.r47-verification-status').textContent.includes('読み込めません'));await f.locator('.r47-verification-retry').click();results.push('blocked Turnstile script can retry');}
await p.waitForFunction(()=>document.querySelector('.r47-verification-status').textContent==='認証が完了しました。');
await f.locator('[type=submit]').click();assert.equal(posts,0);
for(const [key,value] of Object.entries({company:'検証会社',family:'検証',given:'太郎',email:'test@example.invalid',tel:'0312345678'}))await f.locator(`[name=${key}]`).fill(value);
await f.locator('[name=agree]').check();
await p.evaluate(()=>{window.__challengeAuto=false;window.__opts['expired-callback']()});await f.locator('[type=submit]').click();assert.equal(posts,0);await p.waitForFunction(()=>document.querySelector('.done').textContent.includes('認証の完了'));
await p.evaluate(()=>{window.__challengeAuto=true;window.__complete()});
mode='failure';await f.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.done').textContent==='送信できませんでした。');assert.equal(await f.locator('[name=company]').inputValue(),'検証会社');
await p.waitForFunction(()=>document.querySelector('.r47-verification-status').textContent==='認証が完了しました。');mode='network';await f.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.done').textContent.includes('送信結果を確認できません'));
await p.waitForFunction(()=>document.querySelector('.r47-verification-status').textContent==='認証が完了しました。');mode='success';await f.locator('[type=submit]').click();assert.equal(await f.locator('[type=submit]').isDisabled(),true);await p.waitForFunction(()=>document.querySelector('.done').textContent==='お問い合わせを受け付けました。');assert.equal(posts,3);assert.equal(await f.locator('[type=submit]').isDisabled(),true);
assert.equal(await p.locator('.r47-form-dlg').evaluate(e=>e.scrollWidth>e.clientWidth),false);
const events=await p.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));assert.equal(events.filter(x=>x[0]==='event'&&x[1]==='generate_lead').length,1);assert.ok(!JSON.stringify(events).includes('test@example.invalid'));
await f.locator('.r47-form-x').click();await p.locator('a[data-cta]:visible').filter({hasText:'資料請求'}).first().click();await p.waitForFunction(()=>document.querySelector('.r47-verification-status').textContent==='認証が完了しました。');assert.equal(await f.locator('[name=company]').inputValue(),'');assert.equal(await f.locator('[type=submit]').isDisabled(),false);
await p.screenshot({path:`/tmp/jusetsu-qa/turnstile-form-${width}.png`});assert.deepEqual(errors,[]);results.push(`width ${width}: token expiry, SMTP error, network error, success, duplicate prevention, reopening, no overflow, analytics`);await ctx.close();
}
await b.close();console.log(JSON.stringify({passed:results.length,results,services:'mocked; no real mail or analytics'},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
