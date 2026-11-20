import {digest} from './password';
export const sessionIdentity=(user:{userId:string;subjectId:string;provider:string})=>digest(JSON.stringify([user.userId,user.subjectId,user.provider]));
