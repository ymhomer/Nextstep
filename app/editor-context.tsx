'use client';
import {createContext,useContext} from 'react';
export const EditorUploadContext=createContext({recordId:'',workspaceId:'',begin:()=>{},end:()=>{}});
export const useImageUploads=()=>useContext(EditorUploadContext);
