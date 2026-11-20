import {recordsRequest} from '../../../../../../../lib/api-handler';import {apiHeaders} from '../../../../../../../lib/api-access';
export const dynamic='force-dynamic';type Context={params:Promise<{id:string;checkId:string}>};
export async function GET(req:Request,ctx:Context){const p=await ctx.params;return recordsRequest(req,'tasks',p.id,p.checkId)}
export const PATCH=GET;export const OPTIONS=()=>new Response(null,{status:204,headers:apiHeaders});
