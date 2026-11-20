'use client';
import {useLayoutEffect,useState} from 'react';
import {visibleWorkspaceFrame} from '../lib/workspace-viewport';
export default function useWorkspaceViewport(enabled:boolean){
 const [mobile,setMobile]=useState(false);
 useLayoutEffect(()=>{
  if(!enabled)return;
  const media=window.matchMedia('(max-width: 640px)'),viewport=window.visualViewport,root=document.documentElement;
  const update=()=>{setMobile(media.matches);if(!media.matches){root.style.removeProperty('--planner-viewport-height');root.style.removeProperty('--planner-viewport-top');return}const frame=visibleWorkspaceFrame(viewport,window.innerHeight);if(frame){root.style.setProperty('--planner-viewport-height',`${frame.height}px`);root.style.setProperty('--planner-viewport-top',`${frame.top}px`)}};
  update();window.addEventListener('resize',update);media.addEventListener('change',update);viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);
  return()=>{window.removeEventListener('resize',update);media.removeEventListener('change',update);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);root.style.removeProperty('--planner-viewport-height');root.style.removeProperty('--planner-viewport-top')};
 },[enabled]);
 return mobile;
}
