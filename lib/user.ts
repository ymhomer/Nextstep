import {sessionIdentity} from './session-identity';
import { headers } from 'next/headers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { getLocalUser } from './local-auth';
import {principalFor} from './account-identity';
export async function getPlannerUser(){const h=await headers();const local=await getLocalUser(h.get('cookie'));const raw=local||await getChatGPTUser();if(!raw)return null;const provider=local?'local' as const:'chatgpt' as const;const user={...raw,provider,subjectId:raw.userId,userId:await principalFor(provider,raw.userId)};const expected=h.get('x-nextstep-session');if(expected&&expected!==sessionIdentity(user))return null;return user;}
