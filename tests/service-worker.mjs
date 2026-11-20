import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const handlers={},shown=[],opened=[];let focused=false,navigated='';
const context={URL,Date,self:{location:{origin:'https://planner.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{},registration:{showNotification:async(title,opts)=>shown.push({title,...opts})},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async url=>opened.push(url)}}};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
let work;const event=data=>({data:{json:()=>data},waitUntil:p=>work=p});handlers.push(event({id:'n1',title:'Nextstep',body:'A new notification',url:'https://evil.test'}));await work;assert.equal(shown[0].tag,'n1');assert.equal(shown[0].data.url,'/?notifications=1');assert.equal(shown[0].body,'A new notification');
handlers.push({data:{json:()=>{throw Error('Bad JSON')}},waitUntil:p=>work=p});await work;assert.equal(shown[1].title,'Nextstep');
handlers.notificationclick({notification:{close:()=>{},data:{url:'https://evil.test'}},waitUntil:p=>work=p});await work;assert.equal(opened[0],'https://planner.test/?notifications=1');
context.self.clients.matchAll=async()=>[{url:'https://planner.test/',navigate:async url=>navigated=url,focus:async()=>focused=true}];handlers.notificationclick({notification:{close:()=>{}},waitUntil:p=>work=p});await work;assert(focused);assert.equal(navigated,'https://planner.test/?notifications=1');assert(!handlers.fetch);
console.log('PASS: service worker displays push, handles invalid payloads, opens only same-origin notification center, focuses existing windows and does not intercept/cache personal requests.');
