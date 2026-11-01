export type SavedEditorView={content:'model'|'scene';position:[number,number,number];target:[number,number,number];up:[number,number,number];zoom:number};
export type EditorWorkspaceState={version:1;views:SavedEditorView[];settings:{drawingMode:string;mode:string;tool:string;fields:Record<string,string>;colorHex:string;pixelPerfect:boolean;xray:boolean;gizmoMode:'translate'|'rotate';workPlanes:{face:number;levels:number[]}}};
export const workspaceFields=['brush-size','brush-shape','thickness','brush-direction','height','layer','tag'] as const;
/** Only durable editor preferences and finite world-space cameras are accepted. */
export function readEditorWorkspaceState(value:unknown):EditorWorkspaceState|null{
 const raw=value as any,vector=(v:any)=>Array.isArray(v)&&v.length===3&&v.every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e9);
 if(!raw||raw.version!==1||!Array.isArray(raw.views)||raw.views.length!==2)return null;
 if(raw.views.some((v:any)=>!v||!['model','scene'].includes(v.content)||!vector(v.position)||!vector(v.target)||!vector(v.up)||Math.hypot(...v.up)<.01||typeof v.zoom!=='number'||!Number.isFinite(v.zoom)||v.zoom<=0||v.zoom>1e7))return null;
 const s=raw.settings,w=s?.workPlanes,modes=['height','volume','stack','creative','property','model','event','decal'];
 if(!s||!modes.includes(s.drawingMode)||!['selection',...modes].includes(s.mode)||!['brush','rectangle','erase','fill','repaint'].includes(s.tool)||!/^#[\da-f]{6}$/i.test(s.colorHex)||typeof s.pixelPerfect!=='boolean'||typeof s.xray!=='boolean'||!['translate','rotate'].includes(s.gizmoMode))return null;
 if(!w||!Number.isInteger(w.face)||w.face<0||w.face>5||!Array.isArray(w.levels)||w.levels.length!==6||!w.levels.every((n:any)=>Number.isInteger(n)&&Math.abs(n)<=8192))return null;
 const fields:Record<string,string>={};for(const key of workspaceFields)if(typeof s.fields?.[key]==='string'&&s.fields[key].length<80)fields[key]=s.fields[key];
 return {version:1,views:raw.views.map((v:any)=>({content:v.content,position:[...v.position],target:[...v.target],up:[...v.up],zoom:v.zoom})),settings:{drawingMode:s.drawingMode,mode:s.mode,tool:s.tool,fields,colorHex:s.colorHex,pixelPerfect:s.pixelPerfect,xray:s.xray,gizmoMode:s.gizmoMode,workPlanes:{face:w.face,levels:[...w.levels]}}};
}
