import {taskSchema,type Task} from './model';
export function nextDate(date:string,cadence:Task['cadence']):string{
 const [y,m,d]=date.split('-').map(Number);const v=new Date(Date.UTC(y,m-1,d));
 if(cadence==='Monthly'){v.setUTCDate(1);v.setUTCMonth(v.getUTCMonth()+1);const last=new Date(Date.UTC(v.getUTCFullYear(),v.getUTCMonth()+1,0)).getUTCDate();v.setUTCDate(Math.min(d,last));}else v.setUTCDate(v.getUTCDate()+(cadence==='Daily'?1:7));
 return v.toISOString().slice(0,10);
}
export function nextRun(source:Task,id:string):Task{
 const scheduled=source.trigger==='Scheduled'?nextDate(source.scheduled,source.cadence):'';
 const shift=(date:string)=>date&&scheduled?new Date(Date.parse(date+'T12:00:00Z')+Date.parse(scheduled+'T12:00:00Z')-Date.parse(source.scheduled+'T12:00:00Z')).toISOString().slice(0,10):'';
 return taskSchema.parse({...source,id,number:0,tracker:'Task',status:'Ready',completedAt:'',resolvedAt:'',previousRunId:source.id,scheduled,plannedEnd:shift(source.plannedEnd),startTime:scheduled?source.startTime:'',endTime:scheduled?source.endTime:'',due:shift(source.due),dueTime:scheduled?source.dueTime:'',follow:'',followTime:'',waitingOn:'',parentId:'',relatedIds:[],history:[],updateNote:'',actual:'',rootCause:'',resolution:'',checklist:source.checklist.map(c=>({...c,id:crypto.randomUUID(),status:'Pending',result:'',note:'',follow:'',linkedTaskId:'',checkedAt:''}))});
}
