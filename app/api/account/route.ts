import {z} from 'zod';
import {getPlannerUser} from '../../../lib/user';
import {getChatGPTUser} from '../../chatgpt-auth';
import {workspaceDb} from '../../../lib/workspaces';
import {identitiesFor,principalFor,hasAccountData,type Provider} from '../../../lib/account-identity';
import {getLocalUser,createSession,limited} from '../../../lib/local-auth';
import {hashPassword,verifyPassword,digest,randomToken,sessionCookie} from '../../../lib/password';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...(cookie?{'Set-Cookie':cookie}:{})}});
const input=z.object({action:z.enum(['link-email','link-chatgpt','primary','unlink']),provider:z.enum(['local','chatgpt']).optional(),email:z.string().trim().toLowerCase().email().max(254).optional(),password:z.string().min(12).max(128),name:z.string().trim().min(1).max(80).optional()});
type LocalAccount={id:string;email:string;name:string;password_hash:string};
export async function GET(){
 const user=await getPlannerUser();if(!user)return reply({error:'Sign in required.'},401);
 const db=workspaceDb(),bound=await identitiesFor(user.userId),chatgpt=await getChatGPTUser();
 const profile=await db.prepare('SELECT primary_provider AS provider FROM account_profiles WHERE id=?').bind(user.userId).first<{provider:Provider}>();
 const methods=bound.length?bound.map(i=>({provider:i.provider,email:i.email,linkedAt:i.linkedAt})):[{provider:user.provider,email:user.email,linkedAt:null}];
 return reply({methods,primary:profile?.provider||user.provider,current:user.provider,chatgptCandidate:chatgpt?{email:chatgpt.email,alreadyLinked:bound.some(i=>i.provider==='chatgpt'&&i.subject===chatgpt.userId)}:null});
}
export async function POST(req:Request){
 try{return await updateAccount(req)}catch{return reply({error:'Account changed. Reload and verify your remaining sign-in before trying again.'},409)}
}
async function updateAccount(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin.'},403);
 const user=await getPlannerUser();if(!user)return reply({error:'Sign in required.'},401);
 if(!req.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 const raw=await req.text();if(raw.length>4096)return reply({error:'Request too large.'},413);
 let parsed;try{parsed=input.safeParse(JSON.parse(raw))}catch{return reply({error:'Invalid request.'},400)}
 if(!parsed.success)return reply({error:'Enter a valid email and password of 12–128 characters.'},400);
 if(await limited('account-management',user.userId,12,900)||await limited('account-management-ip',req.headers.get('cf-connecting-ip')||'unknown',30,900)||(parsed.data.email&&await limited('account-management-email',parsed.data.email,10,900)))return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
 const a=parsed.data,db=workspaceDb(),bound=await identitiesFor(user.userId),chatgpt=await getChatGPTUser();
 const ownLocal=bound.find(i=>i.provider==='local');
 const local=await db.prepare('SELECT id,email,name,password_hash FROM accounts WHERE id=?').bind(ownLocal?.subject||(user.provider==='local'?user.subjectId:'')).first<LocalAccount>();
 // Every modification to an existing password login requires fresh password proof.
 if(local&&!await verifyPassword(a.password,local.password_hash))return reply({error:'Current password is incorrect.'},401);
 const ownChat=bound.find(i=>i.provider==='chatgpt');
 if(a.action==='primary'||a.action==='unlink'){
  if(!a.provider||bound.length<2)return reply({error:'Keep at least one working sign-in method. Link another method first.'},400);
  if(!bound.some(i=>i.provider===a.provider))return reply({error:'This sign-in method is not linked.'},400);
  if(!local)return reply({error:'A verified password login is required.'},400);
  if(a.action==='primary'){
   const changed=await db.prepare('UPDATE account_profiles SET primary_provider=? WHERE id=? AND EXISTS(SELECT 1 FROM account_identities WHERE principal_id=? AND provider=?)').bind(a.provider,user.userId,user.userId,a.provider).run();return changed.meta.changes?reply({ok:true}):reply({error:'This sign-in was removed. Reload your account.'},409);
  }
  if(a.provider==='local'){
   if(!chatgpt||chatgpt.userId!==ownChat?.subject)return reply({error:'Sign in with the linked ChatGPT account before removing email login.'},400);
   await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').bind(user.userId),db.prepare("DELETE FROM account_identities WHERE principal_id=? AND provider='local'").bind(user.userId),db.prepare('DELETE FROM sessions WHERE account_id=?').bind(local.id),db.prepare('DELETE FROM accounts WHERE id=?').bind(local.id),db.prepare("UPDATE account_profiles SET primary_provider='chatgpt' WHERE id=?").bind(user.userId)]);
   return reply({ok:true,reload:true},200,sessionCookie('',0));
  }
  // Retain a detached mapping so a former ChatGPT subject can never fall back
  // to a legacy owner ID and regain access to this account's data.
  const detached='account:'+crypto.randomUUID();const token=await createSession(local.id,local.password_hash);
  if(!token)return reply({error:'Account changed. Sign in again.'},401);
  await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').bind(user.userId),db.prepare("UPDATE account_identities SET principal_id=? WHERE principal_id=? AND provider='chatgpt'").bind(detached,user.userId),db.prepare("INSERT INTO account_profiles(id,primary_provider) VALUES (?,'chatgpt')").bind(detached),db.prepare("UPDATE account_profiles SET primary_provider='local' WHERE id=?").bind(user.userId)]);
  return reply({ok:true,reload:true},200,sessionCookie(token));
 }
 let target:{provider:Provider;subject:string;email:string;name:string};let recoveryCode:string|undefined;let newAccount:LocalAccount|null=null;
 if(a.action==='link-email'){
  if(local)return reply({error:'Email login is already linked.'},400);
  if(!a.email)return reply({error:'Email is required.'},400);
  const existing=await db.prepare('SELECT id,email,name,password_hash FROM accounts WHERE email=?').bind(a.email).first<LocalAccount>();
  if(existing&&!await verifyPassword(a.password,existing.password_hash))return reply({error:'Email or password is incorrect.'},401);
  if(!existing){recoveryCode=randomToken();newAccount={id:'local:'+crypto.randomUUID(),email:a.email,name:a.name||user.displayName,password_hash:await hashPassword(a.password)}}
  const account=existing||newAccount!;target={provider:'local',subject:account.id,email:account.email,name:account.name};
 }else{
  if(ownChat||user.provider==='chatgpt')return reply({error:'ChatGPT is already linked.'},400);
  if(!local||!chatgpt)return reply({error:'Sign in with ChatGPT, then confirm the link with your current password.'},400);
  target={provider:'chatgpt',subject:chatgpt.userId,email:chatgpt.email,name:chatgpt.displayName};
 }
 const targetId=await principalFor(target.provider,target.subject),targetMethods=await identitiesFor(targetId);
 if(targetId!==user.userId&&(targetMethods.length>1||await hasAccountData(targetId)))return reply({error:'That sign-in already has separate planner data or workspace access. Accounts with existing data cannot be merged here. Export and resolve the separate account first; no data has changed.'},409);
 const statements=[];
 if(targetId!==user.userId)statements.push(db.prepare('DELETE FROM account_profiles WHERE id=? AND NOT EXISTS(SELECT 1 FROM planners WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM workspace_members WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM images WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM private_plans WHERE user_id=?) AND (SELECT COUNT(*) FROM account_identities WHERE principal_id=?)<2').bind(targetId,targetId,targetId,targetId,targetId,targetId));
 if(newAccount)statements.push(db.prepare('INSERT INTO accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').bind(newAccount.id,newAccount.email,newAccount.name,newAccount.password_hash,digest(recoveryCode!),Date.now()));
 statements.push(db.prepare('INSERT OR IGNORE INTO account_profiles(id,primary_provider) VALUES (?,?)').bind(user.userId,user.provider));
 statements.push(db.prepare('INSERT INTO account_identities(provider,subject,principal_id,email,name,linked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET principal_id=excluded.principal_id,email=excluded.email,name=excluded.name WHERE account_identities.principal_id=excluded.principal_id').bind(user.provider,user.subjectId,user.userId,user.email,user.displayName,Date.now()));
 // A standalone detached identity can be attached again only while empty.
 statements.push(db.prepare('INSERT INTO account_identities(provider,subject,principal_id,email,name,linked_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM account_identities WHERE provider=? AND subject=? AND principal_id=?) AND NOT EXISTS(SELECT 1 FROM planners WHERE user_id=? AND user_id!=?) AND NOT EXISTS(SELECT 1 FROM workspace_members WHERE user_id=? AND user_id!=?) AND NOT EXISTS(SELECT 1 FROM images WHERE user_id=? AND user_id!=?) AND NOT EXISTS(SELECT 1 FROM private_plans WHERE user_id=? AND user_id!=?) ON CONFLICT(provider,subject) DO UPDATE SET principal_id=excluded.principal_id,linked_at=excluded.linked_at WHERE account_identities.principal_id=? AND NOT EXISTS(SELECT 1 FROM account_identities other WHERE other.principal_id=? AND other.provider!=?)').bind(target.provider,target.subject,user.userId,target.email,target.name,Date.now(),user.provider,user.subjectId,user.userId,targetId,user.userId,targetId,user.userId,targetId,user.userId,targetId,user.userId,targetId,targetId,target.provider));
 try{const results=await db.batch(statements);if(!results.at(-1)?.meta.changes)return reply({error:'This identity changed or was linked elsewhere. Reload before trying again.'},409)}catch{return reply({error:'This sign-in is already linked, or the account changed. Reload before trying again.'},409)}
 return reply({ok:true,recoveryCode});
}
