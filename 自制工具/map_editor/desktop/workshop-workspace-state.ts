import {readEditorWorkspaceState,type EditorWorkspaceState,type SavedEditorView} from './editor-workspace-state.ts';
export type SavedCamera={position:[number,number,number];target:[number,number,number];up:[number,number,number];zoom:number};
export type ModelPreviewState={scope:'model'|'scene';sceneId:string;modelCamera:SavedEditorView|null;sceneCameras:Record<string,SavedEditorView>};
export type AssetWorkspaceState={activeCanvasId:string;selectedObjectIds:string[];editObjectId:string|null;objectMode:boolean};
export type WorkshopLayoutState={preview:boolean;assets:boolean;hierarchy:boolean;inspector:boolean;width:number;hierarchyTab?:'objects'|'canvases';narrowTree?:boolean;task?:'model'|'asset';openDetails?:string[]};
export type WorkshopWorkspaceState={version:1;projectId:string;workspace:'project'|'module'|'assembly';assetId:string;sceneId:string;assets:Record<string,AssetWorkspaceState>;editor:EditorWorkspaceState|null;preview:ModelPreviewState;assembly:SavedCamera|null;layout:WorkshopLayoutState|null};
const key='xh-workshop-workspace-v1',limit=512*1024;
const id=(v:unknown):v is string=>typeof v==='string'&&v.length<=200&&!['__proto__','prototype','constructor'].includes(v);
const vector=(v:any)=>Array.isArray(v)&&v.length===3&&v.every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e9);
export function readSavedCamera(v:any):SavedCamera|null{
 if(!v||!vector(v.position)||!vector(v.target)||!vector(v.up)||Math.hypot(...v.up)<.01||typeof v.zoom!=='number'||!Number.isFinite(v.zoom)||v.zoom<=0||v.zoom>1e7)return null;
 return {position:[...v.position] as SavedCamera['position'],target:[...v.target] as SavedCamera['target'],up:[...v.up] as SavedCamera['up'],zoom:v.zoom};
}
function readEditorView(v:any,content:'model'|'scene'):SavedEditorView|null{const camera=readSavedCamera(v);return camera&&v.content===content?{content,...camera}:null;}
export function readPreviewState(v:any):ModelPreviewState{
 const cameras:Record<string,SavedEditorView>={};for(const [key,value]of Object.entries(v?.sceneCameras??{}).slice(0,64)){const c=readEditorView(value,'scene');if(id(key)&&c)cameras[key]=c;}
 return {scope:v?.scope==='scene'?'scene':'model',sceneId:id(v?.sceneId)?v.sceneId:'',modelCamera:readEditorView(v?.modelCamera,'model'),sceneCameras:cameras};
}
export function readLayoutState(v:any):WorkshopLayoutState|null{
 if(!v||!['preview','assets','hierarchy','inspector'].every(k=>typeof v[k]==='boolean')||!Number.isFinite(v.width))return null;
 const state:WorkshopLayoutState={preview:v.preview,assets:v.assets,hierarchy:v.hierarchy,inspector:v.inspector,width:Math.max(240,Math.min(380,v.width))};
 if(['objects','canvases'].includes(v.hierarchyTab))state.hierarchyTab=v.hierarchyTab;if(typeof v.narrowTree==='boolean')state.narrowTree=v.narrowTree;if(['model','asset'].includes(v.task))state.task=v.task;
 if(Array.isArray(v.openDetails))state.openDetails=v.openDetails.filter((id:unknown)=>['current-color-properties','module-root-menu','modeling-work-plane','reference-import'].includes(id as string));return state;
}
/** A deliberate metadata whitelist: cells, paint, histories and draft payloads never enter this store. */
export function readWorkshopWorkspaceState(v:any):WorkshopWorkspaceState|null{
 if(!v||v.version!==1||!id(v.projectId)||!['project','module','assembly'].includes(v.workspace)||!id(v.assetId)||!id(v.sceneId))return null;
 const assets:Record<string,AssetWorkspaceState>={};for(const [key,value]of Object.entries(v.assets??{}).slice(0,256)){const a=value as any;if(!id(key)||!id(a?.activeCanvasId)||typeof a.objectMode!=='boolean')continue;assets[key]={activeCanvasId:a.activeCanvasId,selectedObjectIds:Array.isArray(a.selectedObjectIds)?[...new Set(a.selectedObjectIds.filter(id))].slice(0,256) as string[]:[],editObjectId:id(a.editObjectId)?a.editObjectId:null,objectMode:a.objectMode};}
 return {version:1,projectId:v.projectId,workspace:v.workspace,assetId:v.assetId,sceneId:v.sceneId,assets,editor:readEditorWorkspaceState(v.editor),preview:readPreviewState(v.preview),assembly:readSavedCamera(v.assembly),layout:readLayoutState(v.layout)};
}
export const normalizedProjectRoot=(root:string)=>root.replace(/\\/g,'/').replace(/\/+$/,'');
type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
export class WorkshopWorkspaceStore{
 private storage:Storage;
 constructor(storage:Storage){this.storage=storage;}
 private readAll():{version:1;lastRoot:string;projects:Record<string,WorkshopWorkspaceState>}{
  const empty={version:1 as const,lastRoot:'',projects:{}};try{const text=this.storage.getItem(key);if(!text||text.length>limit)return empty;const raw=JSON.parse(text);if(raw.version!==1||typeof raw.lastRoot!=='string'||raw.lastRoot.length>4000||!raw.projects||typeof raw.projects!=='object')return empty;const projects:Record<string,WorkshopWorkspaceState>={};for(const [root,value]of Object.entries(raw.projects).slice(-12)){if(root.length>4000||['__proto__','constructor','prototype'].includes(root))continue;const state=readWorkshopWorkspaceState(value);if(state)projects[root]=state;}return{version:1,lastRoot:raw.lastRoot,projects};}catch{return empty;}
 }
 lastRoot(){return this.readAll().lastRoot||null;}
 read(root:string,projectId:string){const state=this.readAll().projects[normalizedProjectRoot(root).toLowerCase()];return state?.projectId===projectId?state:null;}
 save(root:string,value:unknown){const state=readWorkshopWorkspaceState(value);if(!state||!root||root.length>4000)return;const all=this.readAll(),canonical=normalizedProjectRoot(root),entry=canonical.toLowerCase();delete all.projects[entry];all.projects[entry]=state;all.lastRoot=canonical;const entries=Object.entries(all.projects).slice(-12);all.projects=Object.fromEntries(entries);try{const text=JSON.stringify(all);if(text.length<=limit&&text!==this.storage.getItem(key))this.storage.setItem(key,text);}catch{/* Preferences never prevent saving or opening source documents. */}}
}
