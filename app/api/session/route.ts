import {sessionIdentity} from '../../../lib/session-identity';
import {getPlannerUser} from '../../../lib/user';
export const dynamic='force-dynamic';
export async function GET(){const user=await getPlannerUser();return Response.json(user?{ok:true,...((typeof __NEXTSTEP_STANDALONE__ !== 'undefined' && __NEXTSTEP_STANDALONE__)?{name:user.displayName,identity:sessionIdentity(user)}:{})}:{error:'Your session expired or the signed-in account changed.'},{status:user?200:401,headers:{'Cache-Control':'no-store'}})}
