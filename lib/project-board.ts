import {closed,type Task} from './model';
export const boardColumns=[{id:'todo',title:'To do'},{id:'progress',title:'In progress'},{id:'waiting',title:'Waiting / blocked'},{id:'verify',title:'To verify'},{id:'closed',title:'Closed'}] as const;
export function boardColumn(t:Task):string{if(closed(t))return 'closed';if(t.status==='Resolved')return 'verify';if(t.status==='Waiting'||t.status==='Blocked')return 'waiting';if(t.status==='In progress')return 'progress';return 'todo'}
