import type {Task,Project} from './model';
export function taskCompletedDate(t:Task){if(!['Done','Closed'].includes(t.status))return '';if(t.completedAt)return t.completedAt;return [...t.history].reverse().find(h=>h.summary.includes('Status: ')&&new RegExp('Status: [^·]+ → '+t.status+'(?: ·|$)').test(h.summary))?.at||''}
export function taskResolvedDate(t:Task){if(!['Resolved','Closed'].includes(t.status))return '';return t.resolvedAt||[...t.history].reverse().find(h=>/Status: [^·]+ → Resolved(?: ·|$)/.test(h.summary))?.at||''}
export function recordTime(v:string,zone='UTC'){return v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short',timeZone:zone}):'Not recorded'}
export function projectCompletedDate(p:Project){return p.status==='Completed'?p.completedAt:''}
