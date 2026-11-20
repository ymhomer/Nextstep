import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse,type RegistrationResponseJSON,type AuthenticationResponseJSON,type AuthenticatorTransportFuture} from '@simplewebauthn/server';
import {z} from 'zod';
import {workspaceDb} from '../../../lib/workspaces';
import {getPlannerUser} from '../../../lib/user';
import {identitiesFor} from '../../../lib/account-identity';
import {digest,randomToken,sessionCookie,verifyPassword} from '../../../lib/password';
import {limited,createSession} from '../../../lib/local-auth';
export const dynamic='force-dynamic';
const standalone=(typeof __NEXTSTEP_STANDALONE__ !== 'undefined' && __NEXTSTEP_STANDALONE__);
const origin=standalone?'https://ymhomer.github.io':'https://personal-task-planner.ymhomer.chatgpt.site',rpID=new URL(origin).hostname;
const challengeCookie='__Host-nextstep-webauthn';
const reply=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(token:string)=>`${challengeCookie}=${token}; HttpOnly; Secure; ${standalone?'SameSite=None; Partitioned':'SameSite=Strict'}; Path=/; Max-Age=300`;
async function emailAccount(){const u=await getPlannerUser();if(!u)return null;const own=(await identitiesFor(u.userId)).find(i=>i.provider==='local');const id=own?.subject||(u.provider==='local'?u.subjectId:'');return workspaceDb().prepare('SELECT id,email,name,password_hash FROM accounts WHERE id=?').bind(id).first<{id:string;email:string;name:string;password_hash:string}>()}
export async function GET(){const a=await emailAccount();if(!await getPlannerUser())return reply({error:'Sign in required.'},401);const rows=a?await workspaceDb().prepare('SELECT id,name,created_at AS createdAt,last_used_at AS lastUsedAt FROM passkeys WHERE account_id=? ORDER BY created_at').bind(a.id).all():{results:[]};return reply({available:!!a,keys:rows.results})}
const input=z.object({action:z.enum(['register-options','register-verify','login-options','login-verify','rename','remove']),password:z.string().min(12).max(128).optional(),id:z.string().max(1500).optional(),name:z.string().trim().min(1).max(80).optional(),response:z.record(z.unknown()).optional()});
export async function POST(req:Request){
 if(req.headers.get('origin')!==origin)return reply({error:'Invalid origin.'},403);
 try{
 if(await limited('passkey-ip',req.headers.get('cf-connecting-ip')||'unknown',40,900))return reply({error:'Too many attempts. Try later.'},429);
 const raw=await req.text();if(raw.length>30000)return reply({error:'Request too large.'},413);const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return reply({error:'Invalid passkey request.'},400);const a=parsed.data,db=workspaceDb();
 if(a.action==='register-options'||a.action==='rename'||a.action==='remove'){
  const account=await emailAccount();if(!account)return reply({error:'Link Email & password before managing passkeys.'},401);
  if(!a.password||!await verifyPassword(a.password,account.password_hash))return reply({error:'Current email password is incorrect.'},401);
  if(a.action==='rename'||a.action==='remove'){
   if(!a.id)return reply({error:'Choose a passkey.'},400);
   const result=a.action==='remove'?await db.prepare('DELETE FROM passkeys WHERE id=? AND account_id=?').bind(a.id,account.id).run():await db.prepare('UPDATE passkeys SET name=? WHERE id=? AND account_id=?').bind(a.name||'My passkey',a.id,account.id).run();return result.meta.changes?reply({ok:true}):reply({error:'Passkey no longer exists.'},404);
  }
  const existing=await db.prepare('SELECT id FROM passkeys WHERE account_id=?').bind(account.id).all<{id:string}>();if(existing.results.length>=10)return reply({error:'You can save up to 10 passkeys.'},400);
  const options=await generateRegistrationOptions({rpName:'Nextstep',rpID,userID:new TextEncoder().encode(account.id),userName:account.email,userDisplayName:account.name,attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:existing.results.map(k=>({id:k.id})),authenticatorSelection:{residentKey:'required',userVerification:'required'}});
  const token=randomToken();await db.prepare('DELETE FROM webauthn_challenges WHERE expires_at<?').bind(Date.now()).run();await db.prepare('INSERT INTO webauthn_challenges(token_hash,challenge,kind,account_id,password_version,expires_at) VALUES (?,?,?,?,?,?)').bind(digest(token),options.challenge,'register',account.id,digest(account.password_hash),Date.now()+300000).run();return reply({options},200,cookie(token));
 }
 if(a.action==='login-options'){
  const options=await generateAuthenticationOptions({rpID,userVerification:'required'});const token=randomToken();await db.prepare('DELETE FROM webauthn_challenges WHERE expires_at<?').bind(Date.now()).run();await db.prepare('INSERT INTO webauthn_challenges(token_hash,challenge,kind,expires_at) VALUES (?,?,?,?)').bind(digest(token),options.challenge,'login',Date.now()+300000).run();return reply({options},200,cookie(token));
 }
 const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(challengeCookie+'='))?.slice(challengeCookie.length+1)||'';
 const kind=a.action==='register-verify'?'register':'login';const challenge=await db.prepare('DELETE FROM webauthn_challenges WHERE token_hash=? AND kind=? AND expires_at>? RETURNING challenge,account_id,password_version').bind(digest(token),kind,Date.now()).first<{challenge:string;account_id:string|null;password_version:string|null}>();
 if(!challenge||!a.response)return reply({error:'Passkey request expired or already used. Try again.'},400);
 if(kind==='register'){
  const account=await emailAccount();if(!account||account.id!==challenge.account_id||digest(account.password_hash)!==challenge.password_version)return reply({error:'Account changed. Start again.'},401);
  const result=await verifyRegistrationResponse({response:a.response as unknown as RegistrationResponseJSON,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
  if(!result.verified||!result.registrationInfo)return reply({error:'Passkey could not be verified.'},400);
  const c=result.registrationInfo.credential;await db.prepare('INSERT INTO passkeys(id,account_id,public_key,counter,transports,name,created_at) VALUES (?,?,?,?,?,?,?)').bind(c.id,account.id,Buffer.from(c.publicKey).toString('base64url'),c.counter,JSON.stringify(c.transports||[]),a.name||'My passkey',Date.now()).run();return reply({ok:true});
 }
 const response=a.response as unknown as AuthenticationResponseJSON;const key=await db.prepare('SELECT p.*,a.password_hash FROM passkeys p INNER JOIN accounts a ON a.id=p.account_id WHERE p.id=?').bind(response.id).first<{id:string;account_id:string;public_key:string;counter:number;transports:string;password_hash:string}>();if(!key)return reply({error:'This passkey is not registered.'},401);
 if(response.response.userHandle&&response.response.userHandle!==Buffer.from(key.account_id).toString('base64url'))return reply({error:'Passkey account mismatch.'},401);
 const result=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:key.id,publicKey:new Uint8Array(Buffer.from(key.public_key,'base64url')),counter:key.counter,transports:JSON.parse(key.transports) as AuthenticatorTransportFuture[]}});
 if(!result.verified)return reply({error:'Passkey verification failed.'},401);
 const updated=await db.prepare('UPDATE passkeys SET counter=?,last_used_at=? WHERE id=? AND counter=?').bind(result.authenticationInfo.newCounter,Date.now(),key.id,key.counter).run();if(!updated.meta.changes)return reply({error:'Passkey changed. Try again.'},409);
 const session=await createSession(key.account_id,key.password_hash);return session?reply({ok:true},200,sessionCookie(session)):reply({error:'Account changed. Sign in again.'},401);
 }catch{return reply({error:'Passkey verification failed. Please try again.'},400)}
}
