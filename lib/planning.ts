import type {Task} from './model';
export const planningFields=['scheduled','plannedEnd','startTime','endTime','planZone','due','dueTime','follow','followTime','waitingOn'] as const;
export type PlanningDates=Pick<Task,typeof planningFields[number]>;
export function dateTimeInZone(date:string,time:string,zone:string):number|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const target=Date.parse(`${date}T${time}:00Z`);if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==date)return null;
 try{const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});const parts=(n:number)=>{const p=format.formatToParts(new Date(n)),get=(t:string)=>p.find(x=>x.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`};let guess=target;for(let i=0;i<3;i++){const observed=Date.parse(parts(guess)+':00Z');guess+=target-observed}return parts(guess)===`${date}T${time}`?guess:null}catch{return null}
}
export function planningError(t:PlanningDates){
 if(t.plannedEnd&&!t.scheduled)return 'Set a work start date before an end date.';
 if(t.plannedEnd&&t.plannedEnd<t.scheduled)return 'Work end must be on or after the start date.';
 for(const [label,date,time] of [['Work start',t.scheduled,t.startTime],['Work end',t.plannedEnd||t.scheduled,t.endTime],['Deadline',t.due,t.dueTime],['Follow-up',t.follow,t.followTime]])if(time&&(!date||!t.planZone||dateTimeInZone(date,time,t.planZone)===null))return `${label} needs a valid date, time and time zone.`;
 if(t.startTime&&t.endTime&&dateTimeInZone(t.plannedEnd||t.scheduled,t.endTime,t.planZone)!<=dateTimeInZone(t.scheduled,t.startTime,t.planZone)!)return 'Work end time must be after the start time.';
 return '';
}
export const workRange=(t:Task)=>t.scheduled?`${t.scheduled}${t.startTime?' '+t.startTime:''}${t.plannedEnd||t.endTime?' – '+(t.plannedEnd||t.scheduled)+(t.endTime?' '+t.endTime:''):''}${t.planZone&&(t.startTime||t.endTime)?' · '+t.planZone:''}`:'';
export const needsReplanning=(t:Task,today:string)=>!!t.scheduled&&(t.plannedEnd||t.scheduled)<today;
export type ReminderSpec={mode:'fixed'|'relative';at:number|null;anchor:'start'|'end'|'deadline'|'follow';offsetMinutes:number};
export function reminderTime(spec:ReminderSpec,t:Task):number|null{if(spec.mode==='fixed')return spec.at;const [date,time]=spec.anchor==='start'?[t.scheduled,t.startTime]:spec.anchor==='end'?[t.plannedEnd||t.scheduled,t.endTime]:spec.anchor==='deadline'?[t.due,t.dueTime]:[t.follow,t.followTime];const base=dateTimeInZone(date,time,t.planZone);return base===null?null:base+spec.offsetMinutes*60000;}

export function isQuiet(now:number,zone:string,start:string,end:string){if(!start||!end||start===end)return false;try{const parts=new Intl.DateTimeFormat('en',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)),time=(parts.find(p=>p.type==='hour')?.value||'00')+':'+(parts.find(p=>p.type==='minute')?.value||'00');return start<end?time>=start&&time<end:time>=start||time<end}catch{return false}}
/** Calendar selection moves the work range together; independent dates stay put. */
export function moveWorkStart(value:PlanningDates,date:string):PlanningDates{const delta=value.scheduled?Date.parse(date+'T12:00:00Z')-Date.parse(value.scheduled+'T12:00:00Z'):0;const end=value.plannedEnd&&value.scheduled&&Number.isFinite(delta)?new Date(Date.parse(value.plannedEnd+'T12:00:00Z')+delta).toISOString().slice(0,10):value.plannedEnd;return {...value,scheduled:date,plannedEnd:end}}
