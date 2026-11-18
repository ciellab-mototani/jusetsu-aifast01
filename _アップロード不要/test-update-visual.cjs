const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const csp=fs.readFileSync(path.join(root,'.htaccess'),'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const mock=`window.__challengeAuto=true;window.turnstile={render:(e,o)=>{window.__opts=o;e.textContent='認証テスト';e.style.height='65px';window.__complete=()=>o.callback('verified-token');if(window.__challengeAuto)setTimeout(window.__complete,10);return 'widget';},remove:()=>{},reset:()=>{if(window.__challengeAuto)setTimeout(window.__complete,10)},isExpired:()=>false};`;
(async()=>{const b=await chromium.launch();let results=[];
for(const width of [1280,390]){
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

await p.goto('https://ai-fast.jp/',{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1800);
for(const sel of ['#fv','#contents','#sales-faq']){await p.locator(sel).scrollIntoViewIfNeeded();await p.waitForTimeout(900);await p.screenshot({path:'/tmp/jusetsu-qa/view-'+width+'-'+sel.slice(1)+'.png'});}
assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await ctx.close();}
await b.close();console.log(JSON.stringify({passed:results.length,checks:'viewport screenshots only; inspect /tmp/jusetsu-qa/view-*.png',results},null,2))})().catch(e=>{console.error(e);process.exit(1)});
