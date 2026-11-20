import type {Task,Sop,Project} from './model';
export type ExportItem=Task|Sop|Project;
export function createdDate(item:ExportItem):string{if(item.createdAt)return item.createdAt;if('history' in item)return item.history.find(h=>/^Created (task|issue)$/.test(h.summary))?.at||'';if('versions' in item)return item.versions.find(v=>v.version===1&&!v.note.includes('Relationship unified.'))?.at||'';return '';}
export function formatExportDate(value:string):string{const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return date.toLocaleDateString('en-GB',{year:'numeric',month:'short',day:'2-digit',timeZone:'Asia/Kuala_Lumpur'});}
export const exportFilename=(value:string)=>value.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim().slice(0,120)||'Export';
