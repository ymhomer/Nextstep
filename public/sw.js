/* Never cache pages, API responses, or personal data. */
const scope = new URL(self.registration.scope);
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?event.data.json():{}}catch{}
 event.waitUntil(self.registration.showNotification(payload.title||'Nextstep',{
  body:payload.body||'You have a new notification. Open Nextstep to view it.',
  icon:new URL('push-icon.png',scope).href,badge:new URL('push-icon.png',scope).href,tag:payload.id||'nextstep',
  data:{url:'/?notifications=1'},timestamp:Date.now()
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL('?notifications=1',scope).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients)if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus()}
  return self.clients.openWindow(url);
 }));
});
self.addEventListener('pushsubscriptionchange',event=>{
 // Never silently assign a renewed subscription to a different signed-in account.
 event.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(c=>c.postMessage({type:'push-subscription-changed'}))));
});

if (scope.origin === 'https://ymhomer.github.io' && scope.pathname === '/Nextstep/') {
 self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || event.request.method !== 'GET') return;
  const path = url.pathname.slice(scope.pathname.length - 1);
  if (!url.pathname.startsWith(scope.pathname) || !/^\/api\/(images|files)\/[a-f0-9-]{36}$/.test(path)) return;
  event.respondWith(fetch(new URL(path, 'https://nextstep-api.ymhomer-4253.workers.dev'), {
   credentials: 'include',
   cache: 'no-store',
   redirect: 'error',
  }));
 });
}
