import {workspaceDb,workspaceScope,editable,type WorkspaceScope} from './workspaces';import {digest} from './password';import {limited} from './local-auth';
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
export type ApiKeyRow={id:string;user_id:string;workspace_id:string;name:string;permission:'read'|'write'|'delete';expires_at:number;revoked_at:number|null};
export const apiHeaders={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match','Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Expose-Headers':'ETag','X-Content-Type-Options':'nosniff'};
export const apiReply=(data:unknown,status=200,revision?:number)=>Response.json(data,{status,headers:{...apiHeaders,...(revision!==undefined?{ETag:`"${revision}"`}:{}),...(status===401?{'WWW-Authenticate':'Bearer'}:{})}});
export async function apiAccess(req:Request,permission:'read'|'write'|'delete'='read'):Promise<{key:ApiKeyRow;scope:WorkspaceScope}>{
 const token=req.headers.get('authorization')?.match(/^Bearer (nxt_[A-Za-z0-9_-]{43})$/)?.[1];if(!token)throw new ApiError(401,'A valid Bearer API key is required.');
 const key=await workspaceDb().prepare('SELECT id,user_id,workspace_id,name,permission,expires_at,revoked_at FROM api_keys WHERE token_hash=?').bind(digest(token)).first<ApiKeyRow>();if(!key||key.revoked_at||key.expires_at<=Date.now())throw new ApiError(401,'API key is invalid, expired or revoked.');
 if(!['read','write','delete'].includes(key.permission)||permission==='write'&&!['write','delete'].includes(key.permission)||permission==='delete'&&key.permission!=='delete')throw new ApiError(403,'This API key does not grant this permission.');
 const requested=new URL(req.url).searchParams.get('workspace');if(requested!==null&&requested!==key.workspace_id)throw new ApiError(403,'This key is restricted to its selected workspace.');
 const scope=await workspaceScope(key.user_id,key.workspace_id);if(!scope||permission!=='read'&&!editable(scope))throw new ApiError(403,'Workspace access is no longer available for this operation.');
 if(await limited('api-key',key.id,120,60))throw new ApiError(429,'Rate limit exceeded. Retry in one minute.');
 await workspaceDb().prepare('UPDATE api_keys SET last_used_at=? WHERE id=? AND (last_used_at IS NULL OR last_used_at<?)').bind(Date.now(),key.id,Date.now()-300000).run();return {key,scope};
}
export function requiredRevision(req:Request){const value=req.headers.get('if-match');if(!value)throw new ApiError(428,'If-Match revision is required. Read the current revision first.');const unquoted=value.startsWith('"')&&value.endsWith('"')?value.slice(1,-1):value;const match=unquoted.match(/^(0|[1-9]\d*)$/);if(!match||!Number.isSafeInteger(Number(match[1])))throw new ApiError(400,'If-Match must be a numeric revision, optionally quoted.');return Number(match[1]);}
