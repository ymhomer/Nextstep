import {disablePushDevice} from '../../../lib/web-push';
import { z } from 'zod';
import { getDb } from '../../../db';
import { accounts, sessions } from '../../../db/schema';
import { and, eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, digest, randomToken, sessionCookie } from '../../../lib/password';
import { createSession, limited, revokeSession } from '../../../lib/local-auth';
export const dynamic='force-dynamic';
const input=z.object({action:z.enum(['register','login','recover','logout']),email:z.string().trim().toLowerCase().email().max(254).optional(),password:z.string().min(12).max(128).optional(),name:z.string().trim().min(1).max(80).optional(),recovery:z.string().min(20).max(100).optional()});
function reply(data:unknown,status=200,cookie?:string){const headers:Record<string,string>={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};if(cookie)headers['Set-Cookie']=cookie;return Response.json(data,{status,headers});}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid request origin.'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 if(Number(req.headers.get('content-length'))>4096)return reply({error:'Request too large.'},413);
 let body;try{const raw=await req.text();if(raw.length>4096)return reply({error:'Request too large.'},413);body=input.safeParse(JSON.parse(raw));}catch{return reply({error:'Invalid request.'},400)}
 if(!body.success)return reply({error:'Enter a valid email and a password of 12–128 characters.'},400);
 const {action,email,password,name,recovery}=body.data;
 if(action==='logout'){await disablePushDevice(req.headers.get('cookie'));await revokeSession(req.headers.get('cookie'));return reply({ok:true},200,sessionCookie('',0));}
 if(!email||!password)return reply({error:'Email and password are required.'},400);
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 if(await limited('auth-ip',ip,40,900)||await limited('auth-email',email,10,900))return reply({error:'Too many attempts. Please try again in 15 minutes.'},429);
 const db=getDb();const rows=await db.select().from(accounts).where(eq(accounts.email,email));const account=rows[0];
 if(action==='register'){
  if(!name)return reply({error:'Enter your name.'},400);
  if(account)return reply({error:'Unable to create this account. Try signing in or account recovery.'},400);
  const id='local:'+crypto.randomUUID(),recoveryCode=randomToken();
  const passwordHash=await hashPassword(password);
  try{await db.insert(accounts).values({id,email,name,passwordHash,recoveryHash:digest(recoveryCode),createdAt:Date.now()});}catch{return reply({error:'Unable to create this account. Try signing in.'},400)}
  const token=await createSession(id,passwordHash);if(!token)return reply({error:'Account changed. Please sign in again.'},401);return reply({ok:true,recoveryCode},200,sessionCookie(token));
 }
 if(action==='recover'){
  if(!account||!recovery||digest(recovery)!==account.recoveryHash)return reply({error:'Email or recovery code is incorrect.'},400);
  const recoveryCode=randomToken(),passwordHash=await hashPassword(password);
  const updated=await db.update(accounts).set({passwordHash,recoveryHash:digest(recoveryCode)}).where(and(eq(accounts.id,account.id),eq(accounts.recoveryHash,account.recoveryHash))).returning({id:accounts.id});
  if(!updated.length)return reply({error:'This recovery code has already been used.'},400);
  await db.delete(sessions).where(eq(sessions.accountId,account.id));
  const token=await createSession(account.id,passwordHash);if(!token)return reply({error:'Account changed. Please sign in again.'},401);return reply({ok:true,recoveryCode},200,sessionCookie(token));
 }
 // Perform the same expensive derivation for unknown accounts to reduce timing leakage.
 const encoded=account?.passwordHash||'scrypt-v1$00000000000000000000000000000000$'+'0'.repeat(128);
 if(!await verifyPassword(password,encoded)||!account)return reply({error:'Email or password is incorrect.'},401);
 const token=await createSession(account.id,account.passwordHash);if(!token)return reply({error:'Account changed. Please sign in again.'},401);return reply({ok:true},200,sessionCookie(token));
}
