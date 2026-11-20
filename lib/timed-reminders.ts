import {workspaceDb,plannerRow,type WorkspaceScope} from './workspaces';
import {dataSchema,closed,type Task} from './model';
import {reminderTime,type ReminderSpec} from './planning';
export type ReminderRow=ReminderSpec&{id:string;taskId:string;createdAt:number};
export async function remindersFor(userId:string,workspace:string,taskId?:string){return (await workspaceDb().prepare('SELECT id,task_id AS taskId,mode,at,anchor,offset_minutes AS offsetMinutes,created_at AS createdAt FROM task_reminders WHERE user_id=? AND workspace_id=?'+(taskId?' AND task_id=?':'')+' ORDER BY created_at DESC LIMIT 500').bind(userId,workspace,...(taskId?[taskId]:[])).all<ReminderRow>()).results}
export async function enqueueTimedReminders(userId:string,scope:WorkspaceScope,now=Date.now()){
 const row=await plannerRow(userId,scope),parsed=row?dataSchema.safeParse(JSON.parse(row.data)):null;if(!parsed?.success)return 0;
 const tasks=new Map(parsed.data.tasks.map(t=>[t.id,t]));const rows=await remindersFor(userId,scope.id);const statements=[];const inserts:number[]=[];
 for(const r of rows){const task=tasks.get(r.taskId);if(!task||closed(task)){statements.push(workspaceDb().prepare("DELETE FROM notifications WHERE user_id=? AND id LIKE ? AND read_at IS NULL").bind(userId,'timed:'+r.id+':%'));continue}const at=reminderTime(r,task);statements.push(workspaceDb().prepare("DELETE FROM notifications WHERE user_id=? AND id LIKE ? AND id!=? AND read_at IS NULL").bind(userId,'timed:'+r.id+':%','timed:'+r.id+':'+at));if(at===null||at>now)continue;
 const id=`timed:${r.id}:${at}`;inserts.push(statements.length);statements.push(workspaceDb().prepare("INSERT OR IGNORE INTO notifications(id,user_id,workspace_id,kind,title,body,created_at,task_id) VALUES (?,?,?,'timed',?,?,?,?)").bind(id,userId,scope.id,'Reminder · '+task.title,new Date(at).toISOString(),now,task.id));}
 if(!statements.length)return 0;const result=await workspaceDb().batch(statements);return inserts.reduce((n,i)=>n+result[i].meta.changes,0);
}
export function reminderView(r:ReminderRow,task:Task){return {...r,resolvedAt:reminderTime(r,task)}}
