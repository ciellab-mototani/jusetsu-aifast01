// Run with PHP_WASM_MODULES=/path/to/node_modules node _アップロード不要/test-contact.mjs
// External Siteverify and SMTP calls are replaced ONLY in the temporary test copy. No emails are sent.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const modules=process.env.PHP_WASM_MODULES;
if(!modules) throw new Error('Set PHP_WASM_MODULES to a directory with @php-wasm/node and @php-wasm/universal');
const {PHP}=await import(pathToFileURL(path.join(modules,'@php-wasm/universal/index.js')));
const {loadNodeRuntime,createNodeFsMountHandler}=await import(pathToFileURL(path.join(modules,'@php-wasm/node/index.js')));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aifast-php-test-'));
fs.mkdirSync(path.join(dir,'public_html'));
const source=fs.readFileSync(new URL('../contact.php',import.meta.url),'utf8');
fs.cpSync(new URL('../server/',import.meta.url),path.join(dir,'public_html/server'),{recursive:true,filter:src=>path.basename(src)!=='contact-config.php'});
const services=path.join(dir,'public_html/server/contact-services.php');
fs.writeFileSync(services,fs.readFileSync(services,'utf8').replace('$result = aifast_siteverify_request(', '$result = aifast_test_siteverify('));
const stub=`
function aifast_test_siteverify($secret,$token) {
 if ($token==='unavailable') return null;
 return ['success'=>$token!=='rejected','hostname'=>$token==='wrong-host'?'evil.example':'ai-fast.jp','action'=>$token==='wrong-action'?'login':'contact','challenge_ts'=>gmdate('c',time()-($token==='expired'?600:0))];
}
function aifast_test_smtp($config,$reply,$subject,$body,$request) {
 if (str_ends_with($request, '-receipt') && is_file(__DIR__.'/fail-receipt')) return 'failed';
 if (is_file(__DIR__.'/uncertain-mail')) return 'uncertain';
 if (is_file(__DIR__.'/fail-mail')) return 'failed';
 file_put_contents(__DIR__.'/mail-log', json_encode([$config['to'],$subject,$body,['From'=>$config['from'],'Reply-To'=>$reply]])."\\n", FILE_APPEND); return 'sent';
}
`;
assert.ok(source.includes('$delivery = aifast_send_smtp('));
fs.writeFileSync(path.join(dir,'public_html/contact.php'),source.replaceAll('= aifast_send_smtp(', '= aifast_test_smtp(')+stub);
const config=path.join(dir,'public_html/server/contact-config.php');
const php=new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: process.pid } }));
php.mkdir('/test'); await php.mount('/test',createNodeFsMountHandler(dir));
let cookie='',token='',serial=0, tests=[];
async function req(method='GET', data, options={}){
 const headers={host:'ai-fast.jp','x-requested-with':'aifast-contact',cookie,...(method==='POST'?{'content-type':'application/json',origin:'https://ai-fast.jp','x-csrf-token':token}:{}),...options.headers};
 const r=await php.run({scriptPath:'/test/public_html/contact.php',relativeUri:'/contact.php',method,protocol:'https',headers,body:options.raw!==undefined || data ? new TextEncoder().encode(options.raw??JSON.stringify(data)) : undefined,$_SERVER:{DOCUMENT_ROOT:'/test/public_html',REMOTE_ADDR:options.ip??'192.0.2.1',HTTP_HOST:'ai-fast.jp',...options.server}});
 const cookies=r.headers['set-cookie'];if(cookies?.length)cookie=cookies[0].split(';')[0];
 let body;try{body=JSON.parse(r.text)}catch{throw new Error(`${r.text}\n${r.errors}`)}
 return {status:r.httpStatusCode,body,headers:r.headers};
}
const payload=()=>({kind:'ask',company:'検証株式会社',family:'検証',given:'太郎',email:'test@example.invalid',tel:'0312345678',form:['FRK'],type:['土地・戸建'],dept:'',role:'',note:'検証用です。\n実送信は行いません。',agree:true,website:'',turnstile_token:'verified-token',request_id:(++serial).toString(16).padStart(32,'0')});
async function check(name,expected,fn){const r=await fn();assert.equal(r.status,expected,`${name}: ${JSON.stringify(r)}`);tests.push(name);return r;}
await check('missing config fails closed',503,()=>req());
fs.writeFileSync(config,`<?php return ['enabled'=>true,'origin'=>'https://ai-fast.jp','to'=>'info@ai-fast.jp','from'=>'info@ai-fast.jp','secret'=>'${'a'.repeat(64)}','turnstile_site_key'=>'0x4AAAAAAFzDHtP2H4_6Y4QX','turnstile_secret_key'=>'${'b'.repeat(40)}','smtp'=>['host'=>'sv16592.xserver.jp','port'=>465,'encryption'=>'smtps','username'=>'info@ai-fast.jp','password'=>'test-only-never-used']];`);
fs.mkdirSync(path.join(dir,'public_html/ai-fist'));fs.copyFileSync(path.join(dir,'public_html/contact.php'),path.join(dir,'public_html/ai-fist/contact.php'));fs.cpSync(path.join(dir,'public_html/server'),path.join(dir,'public_html/ai-fist/server'),{recursive:true});
const subdir=await php.run({scriptPath:'/test/public_html/ai-fist/contact.php',relativeUri:'/ai-fist/contact.php',method:'GET',protocol:'https',headers:{host:'ai-fast.jp','x-requested-with':'aifast-contact'},$_SERVER:{DOCUMENT_ROOT:'/test/public_html',REMOTE_ADDR:'192.0.2.90'}});assert.equal(subdir.httpStatusCode,200);tests.push('subdirectory uses bundled config with private runtime storage');
const session=await check('issue CSRF token',200,()=>req());token=session.body.token;assert.equal(token.length,64);assert.ok(cookie);assert.match(session.headers['set-cookie'][0],/httponly/i);assert.match(session.headers['set-cookie'][0],/secure/i);assert.match(session.headers['set-cookie'][0],/SameSite=Strict/i);
await check('reject cross-origin',403,()=>req('POST',payload(),{headers:{origin:'https://evil.example'}}));
await check('reject missing CSRF',403,()=>req('POST',payload(),{headers:{'x-csrf-token':''}}));
await check('reject missing custom header',403,()=>req('GET',null,{headers:{'x-requested-with':''}}));
await check('reject wrong host',403,()=>req('GET',null,{headers:{host:'evil.example'}}));
await check('reject unsupported method',405,()=>req('PUT'));
await check('reject form encoded',415,()=>req('POST',payload(),{headers:{'content-type':'application/x-www-form-urlencoded'}}));
await check('reject huge body',413,()=>req('POST',null,{raw:'x'.repeat(24001)}));
await check('reject malformed JSON',422,()=>req('POST',null,{raw:'{'}));
const badCases=[['empty company',{company:''}],['email header injection',{email:'test@example.invalid\r\nBcc: attacker@example.invalid'}],['array instead of string',{family:[]}],['no agreement',{agree:false}],['honeypot',{website:'spam'}],['unknown option',{form:['injected']}],['long note',{note:'a'.repeat(4001)}],['unknown field',{to:'attacker@example.invalid'}]];
for(let i=0;i<badCases.length;i++){const [name,fields]=badCases[i];await check(name,422,()=>req('POST',{...payload(),...fields},{ip:`192.0.2.${10+i}`}));}
for(const [i,t] of ['rejected','wrong-host','wrong-action','expired','unavailable'].entries()) {
 await check(`Turnstile ${t}`,t==='unavailable'?503:422,()=>req('POST',{...payload(),turnstile_token:t},{ip:`192.0.2.${30+i}`}));
 assert.equal(fs.existsSync(path.join(dir,'public_html/mail-log')),false);
}
await check('missing Turnstile token',422,()=>req('POST',{...payload(),turnstile_token:''},{ip:'192.0.2.39'}));
const good=payload();await check('valid submission',200,()=>req('POST',good));
await check('idempotent retry',200,()=>req('POST',good));
assert.equal(fs.readFileSync(path.join(dir,'public_html/mail-log'),'utf8').trim().split('\n').length,2);
const mails=fs.readFileSync(path.join(dir,'public_html/mail-log'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
const log=mails[0];
assert.equal(mails[1][0],'test@example.invalid');assert.equal(mails[1][3]['Reply-To'],'info@ai-fast.jp');assert.ok(mails[1][1].includes('受け付けました'));assert.ok(mails[1][2].includes('会社名\n検証株式会社'));assert.ok(mails[1][2].includes('相談事項\n検証用です。\n実送信は行いません。'));assert.ok(!mails[1][2].includes('受付ID'));assert.ok(!mails[0][2].includes('受付ID'));assert.ok(!mails[1][2].includes('\\')); tests.push('user receipt and admin notification sent once with separate recipients');assert.equal(log[0],'info@ai-fast.jp');assert.equal(log[3].From,'info@ai-fast.jp');assert.equal(log[3]['Reply-To'],'test@example.invalid');assert.match(log[2],/検証株式会社/);
await check('changed idempotency payload',409,()=>req('POST',{...good,note:'changed'}));
fs.writeFileSync(path.join(dir,'public_html/fail-mail'),'');const fail=payload();
await check('mail transport failure',503,()=>req('POST',fail,{ip:'192.0.2.60'}));fs.unlinkSync(path.join(dir,'public_html/fail-mail'));
await check('retry after explicit mail failure',200,()=>req('POST',fail,{ip:'192.0.2.60'}));
fs.writeFileSync(path.join(dir,'public_html/uncertain-mail'),'');const uncertain=payload();
await check('ambiguous SMTP result',503,()=>req('POST',uncertain,{ip:'192.0.2.65'}));fs.unlinkSync(path.join(dir,'public_html/uncertain-mail'));
await check('ambiguous delivery must not resend',409,()=>req('POST',uncertain,{ip:'192.0.2.65'}));
const settings=await php.run({code:`<?php require '/test/public_html/server/contact-services.php'; $c=require '/test/public_html/server/contact-config.php'; $m=aifast_make_mailer($c,'reply@example.invalid','日本語件名','日本語本文','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); $m->preSend(); echo json_encode(['auth'=>$m->SMTPAuth,'secure'=>$m->SMTPSecure,'port'=>$m->Port,'verify'=>$m->SMTPOptions['ssl'],'mime'=>$m->getSentMIMEMessage()]);`});
if(settings.errors || !settings.text.startsWith('{')) throw new Error(settings.text+' '+settings.errors);
const mail=JSON.parse(settings.text);assert.equal(mail.auth,true);assert.equal(mail.secure,'ssl');assert.equal(mail.port,465);assert.equal(mail.verify.verify_peer,true);assert.equal(mail.verify.allow_self_signed,false);assert.ok(mail.mime.includes('Reply-To: reply@example.invalid'));assert.ok(!mail.mime.includes('test-only-never-used'));tests.push('real PHPMailer MIME and TLS configuration');
fs.writeFileSync(path.join(dir,'public_html/fail-receipt'),'');
const receiptFail={...payload(),email:'receipt-failure@example.invalid'};
await check('receipt failure preserves successful inquiry',200,()=>req('POST',receiptFail,{ip:'192.0.2.80'}));
const countBeforeRetry=fs.readFileSync(path.join(dir,'public_html/mail-log'),'utf8');
fs.unlinkSync(path.join(dir,'public_html/fail-receipt'));
await check('receipt failure retry does not duplicate notifications',200,()=>req('POST',receiptFail,{ip:'192.0.2.80'}));
assert.equal(fs.readFileSync(path.join(dir,'public_html/mail-log'),'utf8'),countBeforeRetry);
const validConfig=fs.readFileSync(config,'utf8');
fs.writeFileSync(config,validConfig.replace("'encryption'=>'smtps'","'encryption'=>'none'"));await check('reject unencrypted SMTP configuration',503,()=>req());fs.writeFileSync(config,validConfig);
fs.writeFileSync(config,validConfig.replace('0x4AAAAAAFzDHtP2H4_6Y4QX','1x00000000000000000000AA'));await check('reject Turnstile production test keys',503,()=>req());fs.writeFileSync(config,validConfig);
for(let i=0;i<5;i++)await check(`rate-limit allowed ${i+1}`,200,()=>req('POST',{...payload(),email:'rate@example.invalid'},{ip:'192.0.2.70'}));
await check('rate-limit blocks sixth message',429,()=>req('POST',{...payload(),email:'rate@example.invalid'},{ip:'192.0.2.70'}));
assert.ok(fs.existsSync(path.join(dir,'aifast-private/contact.sqlite')));tests.push('runtime directory created outside public root automatically');
fs.writeFileSync(config,validConfig.replace("'origin'=>'https://ai-fast.jp'", "'origins'=>['ai-fast.jp'=>'https://ai-fast.jp','jgtest.xsrv.jp'=>'https://jgtest.xsrv.jp']"));
await check('test hostname selected from allowlist',200,()=>req('GET',null,{headers:{host:'jgtest.xsrv.jp'}}));
await check('unknown hostname rejected',403,()=>req('GET',null,{headers:{host:'evil.example'}}));
fs.writeFileSync(config,validConfig.replace('<?php',"<?php if (!defined('AIFAST_CONTACT')) { http_response_code(404); exit; }"));
const direct=await php.run({scriptPath:'/test/public_html/server/contact-config.php'});assert.equal(direct.httpStatusCode,404);assert.equal(direct.text,'');tests.push('direct config execution returns 404 without content');
console.log(JSON.stringify({passed:tests.length,tests,externalServices:'stubbed; no real SMTP or Cloudflare requests',php:'8.3 WASM'},null,2));
php.exit();
fs.rmSync(dir,{recursive:true,force:true});
