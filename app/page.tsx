import {sessionIdentity} from '../lib/session-identity';
import PlannerApp from './planner';
import { getPlannerUser } from '../lib/user';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getPlannerUser();return <PlannerApp identity={user?sessionIdentity(user):''} signedIn={!!user} name={user?.displayName??''} provider={user?.provider??'chatgpt'}/>;}
