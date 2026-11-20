import {sopSnapshot,type Task,type Planner,type Sop} from './model';
export const referenceIds=(t:Task)=>[...new Set([...(t.sopIds||[]),...(t.sopId?[t.sopId]:[])])];
export const referenceSops=(t:Task,data:Planner)=>data.sops.filter(s=>referenceIds(t).includes(s.id));
export const relatedSops=referenceSops;
export const relatedItemIds=(s:Sop,data:Planner)=>data.tasks.filter(t=>referenceIds(t).includes(s.id)).map(t=>t.id);
/** Consume legacy source/single links once; every live link then lives on task.sopIds. */
export function migrateSopLinks(data:Planner):Planner{
 const tasks=data.tasks.map(t=>({...t,sopId:'',sopIds:[...new Set([...referenceIds(t),...data.sops.filter(s=>s.sourceId===t.id).map(s=>s.id)])]}));
 const sops=data.sops.map(s=>{if(!s.sourceId)return s;const source=data.tasks.find(t=>t.id===s.sourceId);const version=s.version+1,at=new Date().toISOString();return {...s,sourceId:'',version,updatedAt:at,versions:[...s.versions,{actor:'',version,at,note:`Originally created from ${source?.tracker||'item'} #${source?.number||''} · ${source?.title||s.sourceId}. Relationship unified.`,content:sopSnapshot.parse({...s,sourceId:''})}].slice(-20)};});
 return {...data,tasks,sops};
}
export function saveSop(data:Planner,sop:Sop,itemIds?:string[]):Planner{
 const ids=itemIds??relatedItemIds(sop,data);if(ids.some(id=>!data.tasks.some(t=>t.id===id)))throw Error('A related item is no longer available.');
 const tasks=data.tasks.map(t=>({...t,sopId:'',sopIds:[...new Set([...referenceIds(t).filter(id=>id!==sop.id),...(ids.includes(t.id)?[sop.id]:[])])]}));
 return {...data,tasks,sops:data.sops.some(s=>s.id===sop.id)?data.sops.map(s=>s.id===sop.id?{...sop,sourceId:''}:s):[...data.sops,{...sop,sourceId:''}]};
}
export function removeSop(data:Planner,id:string):Planner{return {...data,sops:data.sops.filter(s=>s.id!==id),tasks:data.tasks.map(t=>({...t,sopId:'',sopIds:referenceIds(t).filter(x=>x!==id)}))};}
