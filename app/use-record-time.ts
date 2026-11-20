'use client';
import {useEffect,useState} from 'react';import {recordTime} from '../lib/record-dates';
export function useRecordTime(){const [zone,setZone]=useState('UTC');useEffect(()=>setZone(Intl.DateTimeFormat().resolvedOptions().timeZone),[]);return (value:string)=>recordTime(value,zone)}
