import {workspaceDb} from './workspaces';
export type Provider='local'|'chatgpt';
export type Identity={provider:Provider;subject:string;principalId:string;email:string;name:string;linkedAt:number};
export async function principalFor(provider:Provider,subject:string){
 const row=await workspaceDb().prepare('SELECT principal_id AS id FROM account_identities WHERE provider=? AND subject=?').bind(provider,subject).first<{id:string}>();
 return row?.id||subject;
}
export async function identitiesFor(id:string){return (await workspaceDb().prepare('SELECT provider,subject,principal_id AS principalId,email,name,linked_at AS linkedAt FROM account_identities WHERE principal_id=?').bind(id).all<Identity>()).results;}
export async function hasAccountData(id:string){
 const row=await workspaceDb().prepare(`SELECT
 EXISTS(SELECT 1 FROM planners WHERE user_id=?) OR
 EXISTS(SELECT 1 FROM workspace_members WHERE user_id=?) OR
 EXISTS(SELECT 1 FROM images WHERE user_id=?) OR
 EXISTS(SELECT 1 FROM private_plans WHERE user_id=?) OR EXISTS(SELECT 1 FROM notifications WHERE user_id=?) OR EXISTS(SELECT 1 FROM notification_settings WHERE user_id=?) AS present`).bind(id,id,id,id,id,id).first<{present:number}>();
 return !!row?.present;
}
