import {closed,taskSchema,type Planner,type Task} from './model';
export type RelatedAction='issue'|'subtask'|'follow-up';
export type RelatedDraft={sourceId:string;checkId?:string};
export function relatedTask(source:Task,action:RelatedAction,id:string,checkId?:string):Task{
 const check=checkId?source.checklist.find(c=>c.id===checkId):undefined;
 if(checkId&&!check)throw Error('The source checklist item is no longer available.');
 if(check?.linkedTaskId)throw Error('This checklist item already has linked work.');
 if(action==='subtask'&&closed(source))throw Error('Reopen this item before adding a subtask.');
 const tracker=action==='issue'?'Issue':'Task';
 return taskSchema.parse({id,title:action==='follow-up'?('Follow up: '+(check?.label||source.title)).slice(0,250):check?check.label:'Untitled',projectId:source.projectId,tracker,status:tracker==='Issue'?'New':'Ready',scheduled:'',due:'',follow:'',waitingOn:'',notes:check?.instructions||'',priority:'Normal',minutes:0,parentId:action==='subtask'?source.id:'',relatedIds:action==='subtask'?[]:[source.id]});
}
/** Commit a new item and its optional checklist source together, never while drafting. */
export function withRelatedTask(data:Planner,task:Task,origin:RelatedDraft):Planner{
 const source=data.tasks.find(t=>t.id===origin.sourceId);if(!source)throw Error('The source item is no longer available. Your draft is still open.');
 if(task.id===source.id)throw Error('An item cannot be related to itself.');
 const check=origin.checkId?source.checklist.find(c=>c.id===origin.checkId):undefined;
 if(origin.checkId&&(!check||check.linkedTaskId&&check.linkedTaskId!==task.id))throw Error('This checklist item already has linked work or is no longer available. Your draft is still open.');
 const relatedIds=task.parentId===source.id?task.relatedIds:[...new Set([...task.relatedIds,source.id])];
 if(relatedIds.length>50)throw Error('This item has reached its limit of 50 related links.');
 return {...data,tasks:[...data.tasks.filter(t=>t.id!==task.id).map(t=>t.id===source.id&&origin.checkId?{...t,checklist:t.checklist.map(c=>c.id===origin.checkId?{...c,linkedTaskId:task.id}:c)}:t),{...task,relatedIds}]};
}
export function linkExistingWork(data:Planner,sourceId:string,targetId:string):Planner{
 if(sourceId===targetId)throw Error('Choose a different item.');const source=data.tasks.find(t=>t.id===sourceId),target=data.tasks.find(t=>t.id===targetId);if(!source||!target)throw Error('One of these items is no longer available.');
 if(source.relatedIds.includes(targetId)||target.relatedIds.includes(sourceId)||source.parentId===targetId||target.parentId===sourceId)return data;
 if(source.relatedIds.length>=50)throw Error('This item has reached its limit of 50 related links.');
 return {...data,tasks:data.tasks.map(t=>t.id===sourceId?{...t,relatedIds:[...t.relatedIds,targetId]}:t)};
}
