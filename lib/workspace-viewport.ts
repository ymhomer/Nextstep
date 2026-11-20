/** A visual viewport frame in CSS pixels. Ignore pinch zoom so the app remains zoomable. */
export function visibleWorkspaceFrame(viewport:{height:number;offsetTop:number;scale:number}|null,fallbackHeight:number){
 if(viewport&&Math.abs(viewport.scale-1)>.01)return null;
 const height=viewport?.height??fallbackHeight;
 if(!Number.isFinite(height)||height<=0)return null;
 return {height:Math.round(height),top:Math.max(0,Math.round(viewport?.offsetTop||0))};
}
/** Mobile scroll belongs to the middle pane, desktop scroll belongs to the document. */
export function resetWorkspacePosition(pane:HTMLElement|null,mobile:boolean,view:Window=window){
 pane?.scrollTo({top:0,left:0,behavior:'instant'});
 if(!mobile)view.scrollTo({top:0,left:0,behavior:'instant'});
}
/** One lock is shared by all modal types, so switching reader → editor never unlocks the page. */
export function lockWorkspacePosition(pane:HTMLElement|null,mobile:boolean,view:Window=window,doc:Document=document){
 const body=doc.body;const x=view.scrollX,y=view.scrollY;const paneX=pane?.scrollLeft||0,paneY=pane?.scrollTop||0;
 const keys=['position','top','left','width','overflow','paddingRight'] as const;
 const previous=Object.fromEntries(keys.map(k=>[k,body.style[k]]));const paneOverflow=pane?.style.overflow||'';
 body.style.overflow='hidden';if(pane)pane.style.overflow='hidden';
 if(!mobile){const gap=view.innerWidth-doc.documentElement.clientWidth;Object.assign(body.style,{position:'fixed',top:`-${y}px`,left:'0',width:'100%'});if(gap>0)body.style.paddingRight=`${gap}px`}
 return ()=>{Object.assign(body.style,previous);if(pane){pane.style.overflow=paneOverflow;pane.scrollTo({top:paneY,left:paneX,behavior:'instant'})}if(!mobile)view.scrollTo({top:y,left:x,behavior:'instant'})};
}
