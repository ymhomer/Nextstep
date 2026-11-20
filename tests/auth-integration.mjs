import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const wr=createRequire(require.resolve('wrangler/package.json'));const {Miniflare}=wr('miniflare');const {build}=wr('esbuild');
const bundle=await build({stdin:{contents:"import {POST} from './app/api/auth/route'; import {getLocalUser} from './lib/local-auth'; export default {async fetch(req){if(new URL(req.url).pathname==='/whoami')return Response.json(await getLocalUser(req.headers.get('cookie')));return POST(req)}};",resolveDir:process.cwd(),sourcefile:'auth-test-entry.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*']});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'test-db'}});
try{
const db=await mf.getD1Database('DB');for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const q of fs.readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').filter(x=>x.trim()))await db.prepare(q).run();
const post=(data,cookie='',origin='https://planner.test')=>mf.dispatchFetch('https://planner.test/api/auth',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'CF-Connecting-IP':'192.0.2.10',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
let r=await post({action:'register',email:'tester@example.com',password:'correct horse nextstep',name:'Tester'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.recoveryCode.length,43);const cookie=r.headers.get('set-cookie');assert(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Lax'));const token=cookie.split(';')[0];
let who=await (await mf.dispatchFetch('https://planner.test/whoami',{headers:{Cookie:token}})).json();assert.equal(who.email,'tester@example.com');const ownerId=who.userId;
const stored=await db.prepare('SELECT * FROM accounts').first();assert(stored.password_hash.startsWith('scrypt-v1$'));assert(!stored.password_hash.includes('correct horse'));assert.notEqual(stored.recovery_hash,body.recoveryCode);
assert.equal((await post({action:'login',email:'tester@example.com',password:'incorrect password here'})).status,401);
assert.equal((await post({action:'login',email:'nobody@example.com',password:'incorrect password here'})).status,401);
r=await post({action:'login',email:'TESTER@example.com',password:'correct horse nextstep'});assert.equal(r.status,200);
assert.equal((await post({action:'logout'},token,'https://evil.example')).status,403);
await post({action:'logout'},token);assert.equal(await (await mf.dispatchFetch('https://planner.test/whoami',{headers:{Cookie:token}})).json(),null);
r=await post({action:'recover',email:'tester@example.com',password:'new correct horse phrase',recovery:body.recoveryCode});assert.equal(r.status,200);const recovery=await r.json();assert.notEqual(recovery.recoveryCode,body.recoveryCode);const newCookie=r.headers.get('set-cookie').split(';')[0];
assert.equal((await post({action:'recover',email:'tester@example.com',password:'another new passphrase',recovery:body.recoveryCode})).status,400);
assert.equal((await post({action:'login',email:'tester@example.com',password:'correct horse nextstep'})).status,401);
assert.equal((await post({action:'login',email:'tester@example.com',password:'new correct horse phrase'})).status,200);
who=await (await mf.dispatchFetch('https://planner.test/whoami',{headers:{Cookie:newCookie}})).json();assert.equal(who.userId,ownerId);
await db.prepare('UPDATE sessions SET expires_at=0').run();assert.equal(await (await mf.dispatchFetch('https://planner.test/whoami',{headers:{Cookie:newCookie}})).json(),null);
for(let i=0;i<12;i++)r=await post({action:'login',email:'limit@example.com',password:'incorrect password here'});assert.equal(r.status,429);
console.log('PASS: registration, scrypt storage, secure cookies, authenticated identity, wrong/unknown password, normalized email, CSRF, logout revocation, recovery rotation, old password rejection, stable identity, expiry and rate limiting.');
}finally{await mf.dispose()}
