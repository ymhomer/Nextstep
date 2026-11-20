import {digest} from './password';
import {workspaceDb,plannerRow,type WorkspaceScope} from './workspaces';
import {dataSchema} from './model';
export async function enqueueReminders(userId:string,scope:WorkspaceScope,today:string){
 const db=workspaceDb(),row=await plannerRow(userId,scope),parsed=row?dataSchema.safeParse(JSON.parse(row.data)):null;const statements=[];if((await db.prepare('SELECT reminders FROM notification_settings WHERE user_id=?').bind(userId).first<{reminders:number}>())?.reminders===0)return 0;
 if(!parsed?.success)return 0;
 const privateRow=scope.id?await db.prepare('SELECT data FROM private_plans WHERE user_id=? AND workspace_id=?').bind(userId,scope.id).first<{data:string}>():null;
 const privateEntries:{taskId:string;follow?:string}[]=privateRow?JSON.parse(privateRow.data):[];const privateFollow=new Map(privateEntries.map(e=>[e.taskId,e.follow||'']));
 for(const t of parsed.data.tasks){if(['Done','Closed','Rejected'].includes(t.status))continue;
  for(const [kind,date] of [['Deadline',t.due],['Follow-up',t.follow],['Private follow-up',privateFollow.get(t.id)||'']])if(date&&date<=today){
   const id=`reminder:${digest(userId)}:${scope.id}:${t.id}:${kind}:${date}`;
   statements.push(db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,workspace_id,kind,title,body,created_at,task_id) SELECT ?,?,?,\'reminder\',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM notification_reads WHERE user_id=? AND notification_id=?)').bind(id,userId,scope.id,`${kind}${date<today?' overdue':' today'} · ${t.title}`,`${t.tracker} #${t.number} · ${date}`,Date.now(),t.id,userId,id));
   if(statements.length>=100)break;
  }if(statements.length>=100)break;
 }
 return statements.length?(await db.batch(statements)).reduce((n,r)=>n+r.meta.changes,0):0;
}
