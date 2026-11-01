import {editorReferences,validateEditorMetadata,withEditorReferences,PROJECT_REFERENCE_LIMIT,type EditorMetadata,type PngReference} from '../core/references.ts';
type CollectedReferences={editor?:EditorMetadata;migrated:boolean;warning?:string};
/** Existing project metadata is authoritative, including an intentionally empty list. */
export function collectProjectReferences(editor:EditorMetadata|undefined,assets:Iterable<{editor?:EditorMetadata;canvases?:{editor?:EditorMetadata}[]}>,options:{document?:object;maxBytes?:number}={}):CollectedReferences{
 if(editor!==undefined){validateEditorMetadata(editor,PROJECT_REFERENCE_LIMIT);return{editor:structuredClone(editor),migrated:false};}
 const fallback=(reason:string):CollectedReferences=>({editor:undefined,migrated:false,warning:reason+'；旧参考完整保留，暂按当前画布显示。请整理参考后重新打开项目以迁移共享参考。'});
 const references:PngReference[]=[],identities=new Set<string>(),seen=new Map<string,Set<string>>();
 for(const asset of assets)for(const source of [asset.editor,...(asset.canvases??[]).map(c=>c.editor)])for(const reference of editorReferences(source)){
  const fingerprint=JSON.stringify({...reference,id:''});let id=reference.id;
  const contents=seen.get(reference.id)??new Set<string>();if(contents.has(fingerprint))continue;contents.add(fingerprint);seen.set(reference.id,contents);
  for(let n=1;identities.has(id);n++)id=reference.id.slice(0,65)+'-legacy-'+n;
  identities.add(id);references.push({...reference,id});
  if(references.length>PROJECT_REFERENCE_LIMIT)return fallback(`旧参考超过项目共享的${PROJECT_REFERENCE_LIMIT}张上限`);
 }
 const next=withEditorReferences(undefined,references,PROJECT_REFERENCE_LIMIT);
 if(new TextEncoder().encode(JSON.stringify({...options.document,editor:next})).byteLength>(options.maxBytes??64*1024*1024))return fallback('合并参考后的项目大小超过64 MiB');
 return{editor:next,migrated:references.length>0};
}
/** Project PNG edits deliberately stay outside every asset's geometry history. */
export class ProjectReferenceHistory {
 private current:EditorMetadata;private past:EditorMetadata[]=[];private future:EditorMetadata[]=[];
 constructor(editor:EditorMetadata={}){validateEditorMetadata(editor,PROJECT_REFERENCE_LIMIT);this.current=structuredClone(editor);}
 read(){return structuredClone(this.current);}
 get canUndo(){return this.past.length>0;}
 get canRedo(){return this.future.length>0;}
 change(recipe:(editor:EditorMetadata)=>EditorMetadata){const next=recipe(this.read());validateEditorMetadata(next,PROJECT_REFERENCE_LIMIT);if(JSON.stringify(next)===JSON.stringify(this.current))return false;this.past.push(this.current);this.current=structuredClone(next);this.future=[];return true;}
 undo(){const next=this.past.pop();if(!next)return false;this.future.push(this.current);this.current=next;return true;}
 redo(){const next=this.future.pop();if(!next)return false;this.past.push(this.current);this.current=next;return true;}
}
