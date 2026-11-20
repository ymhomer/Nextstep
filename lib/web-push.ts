import {isQuiet} from './planning';
import {env} from 'cloudflare:workers';
import {generateRequestDetails} from 'web-push-neo';
import {workspaceDb} from './workspaces';
import {digest} from './password';
export const PUSH_COOKIE='__Host-nextstep-push-device';
export const pushDevice=(cookie:string|null)=>cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(PUSH_COOKIE+'='))?.slice(PUSH_COOKIE.length+1)||'';
export const pushCookie=(token:string)=>`${PUSH_COOKIE}=${token}; HttpOnly; Secure; ${(typeof __NEXTSTEP_STANDALONE__ !== 'undefined' && __NEXTSTEP_STANDALONE__)?'SameSite=None; Partitioned':'SameSite=Strict'}; Path=/; Max-Age=31536000`;
export function pushConfig(){const e=env as unknown as Record<string,string>;return {publicKey:e.WEB_PUSH_PUBLIC_KEY,privateKey:e.WEB_PUSH_PRIVATE_KEY,subject:e.WEB_PUSH_SUBJECT||'https://personal-task-planner.ymhomer.chatgpt.site'}}
export function allowedPushEndpoint(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
export type PushSubscriptionRow={id:string;user_id:string;endpoint:string;p256dh:string;auth:string;show_details:number};
export async function sendPush(s:PushSubscriptionRow,message:{id:string;title:string;body:string}){
 const config=pushConfig();if(!config.publicKey||!config.privateKey)throw Error('Device notification service is not configured.');if(!allowedPushEndpoint(s.endpoint))throw Error('Unsupported push endpoint.');
 const payload=JSON.stringify({id:message.id,title:s.show_details?message.title.slice(0,120):'Nextstep',body:s.show_details?message.body.slice(0,300):'You have a new notification. Open Nextstep to view it.'});
 const request=await generateRequestDetails({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:86400,urgency:'normal',vapidDetails:{subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey}});
 const response=await fetch(request.endpoint,{method:'POST',headers:request.headers as HeadersInit,body:request.body as unknown as BodyInit,redirect:'manual',signal:AbortSignal.timeout(8000)});
 if(response.status===404||response.status===410)await workspaceDb().prepare('DELETE FROM push_subscriptions WHERE id=?').bind(s.id).run();
 else await workspaceDb().prepare('UPDATE push_subscriptions SET last_status=?,last_sent_at=CASE WHEN ? THEN ? ELSE last_sent_at END WHERE id=?').bind(response.status,response.ok?1:0,Date.now(),s.id).run();
 return {accepted:response.ok,status:response.status};
}
export async function flushPushQueue(onlyUser?:string){
 const c=pushConfig();if(!c.publicKey||!c.privateKey)return;
 const db=workspaceDb(),now=Date.now();
 const rows=await db.prepare(`SELECT s.id,s.user_id,s.endpoint,s.p256dh,s.auth,s.show_details,n.id AS notificationId,n.title,n.body,COALESCE(p.time_zone,'UTC') AS timeZone,p.quiet_start AS quietStart,p.quiet_end AS quietEnd
 FROM notifications n INNER JOIN push_subscriptions s ON s.user_id=n.user_id
 LEFT JOIN notification_settings p ON p.user_id=n.user_id
 LEFT JOIN push_deliveries d ON d.notification_id=n.id AND d.subscription_id=s.id
 WHERE n.created_at>=s.created_at AND n.created_at>? AND n.read_at IS NULL
 AND (d.notification_id IS NULL OR (d.delivered_at IS NULL AND d.next_attempt<=? AND d.attempts<4))
 AND (? IS NULL OR n.user_id=?) ORDER BY n.created_at LIMIT 12`).bind(now-86400000,now,onlyUser||null,onlyUser||null).all<PushSubscriptionRow&{notificationId:string;title:string;body:string;timeZone:string;quietStart:string;quietEnd:string}>();
 await Promise.allSettled(rows.results.map(async row=>{
  if(isQuiet(now,row.timeZone,row.quietStart,row.quietEnd))return;
  const claim=await db.prepare('INSERT INTO push_deliveries(notification_id,subscription_id,next_attempt,attempts) VALUES (?,?,?,1) ON CONFLICT(notification_id,subscription_id) DO UPDATE SET next_attempt=excluded.next_attempt,attempts=push_deliveries.attempts+1 WHERE push_deliveries.delivered_at IS NULL AND push_deliveries.next_attempt<=? AND push_deliveries.attempts<4 RETURNING attempts').bind(row.notificationId,row.id,now+300000,now).first();if(!claim)return;
  try{const sent=await sendPush(row,{id:row.notificationId,title:row.title,body:row.body});if(sent.accepted)await db.prepare('UPDATE push_deliveries SET delivered_at=? WHERE notification_id=? AND subscription_id=?').bind(Date.now(),row.notificationId,row.id).run()}catch{/* Retain the bounded retry lease; no credentials or endpoints are logged. */}
 }));
}
export async function disablePushDevice(cookie:string|null){const token=pushDevice(cookie);if(token)await workspaceDb().prepare('DELETE FROM push_subscriptions WHERE device_hash=?').bind(digest(token)).run()}
