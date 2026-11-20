import {enqueueTimedReminders} from '../../../lib/timed-reminders';
import {enqueueReminders} from '../../../lib/reminder-notifications';
import {z} from 'zod';
import {ECDH} from 'node:crypto';
import {getPlannerUser} from '../../../lib/user';
import {workspaceDb,workspaceScope} from '../../../lib/workspaces';
import {flushPushQueue,pushConfig,pushDevice,pushCookie,allowedPushEndpoint,sendPush,type PushSubscriptionRow} from '../../../lib/web-push';
import {digest,randomToken} from '../../../lib/password';
import {limited} from '../../../lib/local-auth';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(req:Request){const user=await getPlannerUser();if(!user)return reply({error:'Sign in required.'},401);const config=pushConfig();const device=pushDevice(req.headers.get('cookie'));const row=device?await workspaceDb().prepare('SELECT id,name,show_details AS showDetails,last_status AS lastStatus,last_sent_at AS lastSentAt FROM push_subscriptions WHERE user_id=? AND device_hash=?').bind(user.userId,digest(device)).first():null;const preferences=await workspaceDb().prepare('SELECT time_zone AS timeZone,reminder_hour AS reminderHour FROM notification_settings WHERE user_id=?').bind(user.userId).first();const job=await workspaceDb().prepare("SELECT enabled,last_run_at AS lastRunAt FROM push_job_state WHERE id='reminders'").first<{enabled:number;lastRunAt:number}>();return reply({configured:!!(config.publicKey&&config.privateKey),publicKey:config.publicKey||'',device:row,scheduledReminders:!!job?.enabled,schedule:preferences||{timeZone:'UTC',reminderHour:9},lastJobRun:job?.lastRunAt||null})}
const timeZone=z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}});
const endpoint=z.string().max(3000).refine(allowedPushEndpoint);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('subscribe'),subscription:z.object({endpoint,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})}),name:z.string().trim().min(1).max(80),showDetails:z.boolean().default(false),timeZone:timeZone.default('UTC')}),
 z.object({action:z.literal('disable'),endpoint:endpoint.optional()}),
 z.object({action:z.literal('test')}),
 z.object({action:z.literal('details'),showDetails:z.boolean()}),
 z.object({action:z.literal('schedule'),timeZone,reminderHour:z.number().int().min(0).max(23)}),
 z.object({action:z.literal('reminders'),workspace:z.string().max(100),today:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})
]);
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin.'},403);
 const user=await getPlannerUser();if(!user)return reply({error:'Sign in required.'},401);
 const raw=await req.text();if(raw.length>7000)return reply({error:'Request too large.'},413);let parsed;try{parsed=input.safeParse(JSON.parse(raw))}catch{return reply({error:'Invalid request.'},400)}if(!parsed.success)return reply({error:'Invalid subscription. This browser’s push service may not be supported.'},400);
 const a=parsed.data,db=workspaceDb(),deviceToken=pushDevice(req.headers.get('cookie')),deviceHash=digest(deviceToken);
 if(a.action==='reminders'){
  if(await limited('push-reminder-sync',user.userId,120,3600))return reply({ok:true});
  const subscribed=await db.prepare('SELECT id FROM push_subscriptions WHERE user_id=? LIMIT 1').bind(user.userId).first();if(!subscribed)return reply({ok:true});
  const preference=await db.prepare('SELECT reminders,time_zone AS timeZone,reminder_hour AS reminderHour FROM notification_settings WHERE user_id=?').bind(user.userId).first<{reminders:number;timeZone:string;reminderHour:number}>();const scope=await workspaceScope(user.userId,a.workspace);if(!scope)return reply({error:'Workspace unavailable.'},404);await enqueueTimedReminders(user.userId,scope);if(preference?.reminders===0){await flushPushQueue(user.userId);return reply({ok:true})}
  if(preference){const hour=Number(new Intl.DateTimeFormat('en',{timeZone:preference.timeZone,hour:'2-digit',hourCycle:'h23'}).format(new Date()));if(hour<preference.reminderHour){await flushPushQueue(user.userId);return reply({ok:true})}}
  await enqueueReminders(user.userId,scope,a.today);await flushPushQueue(user.userId);return reply({ok:true});
 }
 if(await limited('push-settings',user.userId,60,3600))return reply({error:'Too many requests. Please try later.'},429);
 if(a.action==='schedule'){await db.prepare('INSERT INTO notification_settings(user_id,invite_code,time_zone,reminder_hour,timezone_set) VALUES (?,?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET time_zone=excluded.time_zone,reminder_hour=excluded.reminder_hour,timezone_set=1').bind(user.userId,crypto.randomUUID(),a.timeZone,a.reminderHour).run();return reply({ok:true})}
 if(a.action==='disable'){await db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND (device_hash=? OR id=?)').bind(user.userId,deviceHash,a.endpoint?digest(a.endpoint):'').run();return reply({ok:true})}
 const config=pushConfig();if(!config.publicKey||!config.privateKey)return reply({error:'Device notification service is not configured.'},503);
 if(a.action==='subscribe'){
  try{const key=Buffer.from(a.subscription.keys.p256dh,'base64url');if(key.length!==65||key[0]!==4||Buffer.from(a.subscription.keys.auth,'base64url').length!==16)throw Error();ECDH.convertKey(key,'prime256v1')}catch{return reply({error:'Invalid browser subscription keys.'},400)}
  const id=digest(a.subscription.endpoint);const count=await db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=? AND id!=?').bind(user.userId,id).first<{n:number}>();if((count?.n||0)>=10)return reply({error:'You can enable up to 10 devices.'},400);
  const token=/^[A-Za-z0-9_-]{43}$/.test(deviceToken)?deviceToken:randomToken();
  await db.prepare('INSERT INTO notification_settings(user_id,invite_code,time_zone,timezone_set) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET time_zone=CASE WHEN notification_settings.timezone_set=0 THEN excluded.time_zone ELSE notification_settings.time_zone END,timezone_set=1').bind(user.userId,crypto.randomUUID(),a.timeZone).run();
  await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE device_hash=? AND id!=?').bind(digest(token),id),db.prepare('INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,device_hash,name,show_details,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,device_hash=excluded.device_hash,name=excluded.name,show_details=excluded.show_details,created_at=CASE WHEN push_subscriptions.user_id!=excluded.user_id THEN excluded.created_at ELSE push_subscriptions.created_at END').bind(id,user.userId,a.subscription.endpoint,a.subscription.keys.p256dh,a.subscription.keys.auth,digest(token),a.name,a.showDetails?1:0,Date.now())]);return reply({ok:true},200,pushCookie(token));
 }
 const subscription=await db.prepare('SELECT * FROM push_subscriptions WHERE user_id=? AND device_hash=?').bind(user.userId,deviceHash).first<PushSubscriptionRow>();if(!subscription)return reply({error:'Enable notifications on this device first.'},400);
 if(a.action==='details'){await db.prepare('UPDATE push_subscriptions SET show_details=? WHERE id=? AND user_id=?').bind(a.showDetails?1:0,subscription.id,user.userId).run();return reply({ok:true})}
 if(await limited('push-test',user.userId,10,3600))return reply({error:'Test limit reached. Try again later.'},429);
 try{const result=await sendPush({...subscription,show_details:1},{id:'test:'+crypto.randomUUID(),title:'Nextstep · Test notification',body:'Device notifications are enabled on this device.'});return result.accepted?reply({ok:true,accepted:true}):reply({error:result.status===404||result.status===410?'This subscription expired. Enable device notifications again.':`Push service returned ${result.status}. Try again later.`},502)}catch{return reply({error:'Could not contact the push service. Try again later.'},502)}
}
