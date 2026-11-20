export type SyncContext={busy:boolean;privateBusy:boolean;editor:unknown;planningId:string;boardMove:unknown;privateOpen:boolean;linkSource:unknown;revision:number};
export const hasDraft=(c:SyncContext)=>!!(c.editor||c.planningId||c.boardMove||c.privateOpen||c.linkSource);
export const mayApplySnapshot=(revision:number,c:SyncContext)=>revision>=c.revision&&!c.busy&&!c.privateBusy&&!hasDraft(c);
