import {enqueueTimedReminders} from '../../../../lib/timed-reminders';
import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {timingSafeEqual} from 'node:crypto';
import {digest} from '../../../../lib/password';
import {workspaceDb,type WorkspaceRole} from '../../../../lib/workspaces';
import {enqueueReminders} from '../../../../lib/reminder-notifications';
import {flushPushQueue} from '../../../../lib/web-push';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const expected=(env as unknown as Record<string,string>).PUSH_JOB_TOKEN_HASH,token=req.headers.get('x-nextstep-job-token')||'';
 if(!expected||token.length<20||!timingSafeEqual(Buffer.from(digest(token)),Buffer.from(expected)))return reply({error:'Job authorization required.'},401);
 const db=workspaceDb();
 let body:{activate?:boolean;status?:boolean}={};try{const raw=await req.text();if(raw.length>100)return reply({error:'Request too large.'},413);const p=z.object({activate:z.boolean().optional(),status:z.boolean().optional()}).strict().safeParse(raw?JSON.parse(raw):{});if(!p.success)return reply({error:'Invalid job request.'},400);body=p.data}catch{return reply({error:'Invalid request.'},400)}
 if(body.status)return reply(await db.prepare("SELECT enabled,last_run_at AS lastRunAt FROM push_job_state WHERE id='reminders'").first()||{enabled:0,lastRunAt:null});
 if(body.activate){await db.prepare("INSERT INTO push_job_state(id,enabled,last_run_at) VALUES ('reminders',1,?) ON CONFLICT(id) DO UPDATE SET enabled=1").bind(Date.now()).run();return reply({ok:true,enabled:true})}
 const users=await db.prepare('SELECT DISTINCT s.user_id AS id,COALESCE(p.time_zone,\'UTC\') AS timeZone,COALESCE(p.reminder_hour,9) AS reminderHour FROM push_subscriptions s LEFT JOIN notification_settings p ON p.user_id=s.user_id LIMIT 100').all<{id:string;timeZone:string;reminderHour:number}>();
 let queued=0,processed=0;
 for(const user of users.results){
  let parts:Intl.DateTimeFormatPart[];try{parts=new Intl.DateTimeFormat('en-CA',{timeZone:user.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date())}catch{continue}
  const value=(type:string)=>parts.find(p=>p.type===type)?.value||'';const afterHour=Number(value('hour'))>=user.reminderHour;
  const today=`${value('year')}-${value('month')}-${value('day')}`;
  queued+=await enqueueTimedReminders(user.id,{id:'',role:'owner'});if(afterHour)queued+=await enqueueReminders(user.id,{id:'',role:'owner'},today);
  const spaces=await db.prepare("SELECT w.id,m.role FROM workspaces w INNER JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=? AND (w.sharing_enabled=1 OR m.role='owner') LIMIT 50").bind(user.id).all<{id:string;role:WorkspaceRole}>();
  for(const scope of spaces.results){queued+=await enqueueTimedReminders(user.id,scope);if(afterHour)queued+=await enqueueReminders(user.id,scope,today);}
  processed++;
 }
 await flushPushQueue();await db.prepare("INSERT INTO push_job_state(id,enabled,last_run_at) VALUES ('reminders',0,?) ON CONFLICT(id) DO UPDATE SET last_run_at=excluded.last_run_at").bind(Date.now()).run();
 return reply({ok:true,processedUsers:processed,queued});
}
