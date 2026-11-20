'use client';
import {useEffect,useState,useCallback} from 'react';
import {latestRelease} from '../lib/settings';
export default function useReleaseNotes(identity:string){const [unread,setUnread]=useState(false),[dismissed,setDismissed]=useState(true);const key='nextstep-release:'+identity;useEffect(()=>{try{setUnread(localStorage.getItem(key)!==latestRelease);setDismissed(sessionStorage.getItem(key)===latestRelease)}catch{setUnread(false)}},[key]);const read=useCallback(()=>{setUnread(false);try{localStorage.setItem(key,latestRelease)}catch{}},[key]);const dismiss=useCallback(()=>{setDismissed(true);try{sessionStorage.setItem(key,latestRelease)}catch{}},[key]);return {unread,dismissed,read,dismiss};}
