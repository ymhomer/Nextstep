import {Node} from '@tiptap/core';
import {cleanVisual} from './visual';
export const VisualNode=Node.create({name:'visualBlock',group:'block',atom:true,draggable:true,selectable:true,addAttributes(){return {data:{default:null}}},parseHTML(){return [{tag:'div[data-nextstep-visual]',getAttrs:element=>{try{const data=cleanVisual(JSON.parse((element as HTMLElement).getAttribute('data-nextstep-visual')||''));return data?{data}:false}catch{return false}}}]},renderHTML({node}){return ['div',{'data-nextstep-visual':JSON.stringify(cleanVisual(node.attrs.data))},'Chart / diagram']}});
