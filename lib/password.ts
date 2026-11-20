import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,64,options,(err,key)=>err?reject(err):resolve(key)));}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt);return `scrypt-v1$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password:string,encoded:string){const [version,salt,hash]=encoded.split('$');if(version!=='scrypt-v1'||!salt||!hash||hash.length!==128)return false;const key=await derive(password,salt);return timingSafeEqual(key,Buffer.from(hash,'hex'));}
export const randomToken=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const SESSION_COOKIE='__Host-nextstep-session';
export const SESSION_SECONDS=30*24*60*60;
export function sessionCookie(token:string,maxAge=SESSION_SECONDS){return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; ${(typeof __NEXTSTEP_STANDALONE__ !== 'undefined' && __NEXTSTEP_STANDALONE__) ? 'SameSite=None; Partitioned' : 'SameSite=Lax'}; Path=/; Max-Age=${maxAge}`;}
export function readToken(cookie:string|null){const value=cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?value:null;}
