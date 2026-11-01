/** Editor-only PNG references. Source coordinates are metres with Z up. */
export const MAX_REFERENCE_BYTES = 32 * 1024 * 1024;
export const PROJECT_REFERENCE_LIMIT = 256;
export interface PngReference {
  id: string; name: string; dataUrl: string; pixelWidth: number; pixelHeight: number;
  kind?: 'scale' | 'modeling';
  /** Display-only image opacity; omitted legacy modeling references use 50%. */
  opacity?: number;
  x: number; y: number; z: number; height: number; visible: boolean;
  /** Normalized image coordinates, origin at upper left. */
  contentTop: number; contentBottom: number; footX: number; footY: number;
}
export interface EditorMetadata { reference?: PngReference | null; references?: PngReference[] }
/** Legacy single references retain their original metre values and scale purpose. */
export function editorReferences(editor?:EditorMetadata|null):PngReference[]{return editor?.references??(editor?.reference?[editor.reference]:[]);}
export function referenceOpacity(reference:PngReference):number{return reference.opacity??(reference.kind==='modeling'?.5:1);}
/** Keep the old single-scale format readable without duplicating embedded PNGs. */
export function withEditorReferences(editor:EditorMetadata|undefined|null,references:readonly PngReference[],maxReferences=32):EditorMetadata{
  const next={...editor};delete next.reference;delete next.references;
  if(references.length===1&&references[0].kind!=='modeling')next.reference=structuredClone(references[0]);
  else if(references.length)next.references=structuredClone([...references]);
  validateEditorMetadata(next,maxReferences);return next;
}
export function pngDimensions(dataUrl: string): { width: number; height: number } {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,'))
    throw new Error('参考图片必须为内嵌 PNG');
  const encoded = dataUrl.slice(22);
  if (encoded.length > Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 || (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(encoded.replace(/={1,2}$/, ""))))
    throw new Error('PNG 数据无效或超过32MiB');
  const decodedBytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (decodedBytes > MAX_REFERENCE_BYTES) throw new Error('PNG 超过32MiB');
  const head = atob(encoded.slice(0, 44));
  if (head.length < 24 || Array.from(head.slice(0,8),c=>c.charCodeAt(0)).join(',') !== '137,80,78,71,13,10,26,10' || head.slice(12,16) !== 'IHDR')
    throw new Error('PNG 文件头无效');
  const u32 = (at: number) => ((head.charCodeAt(at) * 16777216) + (head.charCodeAt(at+1) << 16) + (head.charCodeAt(at+2) << 8) + head.charCodeAt(at+3));
  const width=u32(16), height=u32(20);
  if (u32(8)!==13 || !width || !height || width>8192 || height>8192 || width*height>32*1024*1024)
    throw new Error('PNG 像素尺寸超限（单边8192，总像素32Mi）');
  return {width,height};
}
export function validateEditorMetadata(editor: unknown,maxReferences=32): void {
  if (editor == null) return;
  if (typeof editor !== 'object' || Array.isArray(editor)) throw new Error('编辑辅助元数据无效');
  const metadata=editor as EditorMetadata;
  if(metadata.references!==undefined&&(!Array.isArray(metadata.references)||metadata.references.length>maxReferences))throw Error(`参考列表无效或超过${maxReferences}张`);
  const references=editorReferences(metadata),ids=new Set<string>();
  for(const r of references){
  if(ids.has(r?.id))throw Error('参考图片身份重复');ids.add(r?.id);
  if(r?.kind!==undefined&&!['scale','modeling'].includes(r.kind))throw Error('参考图片用途无效');
  if(r?.opacity!==undefined&&(typeof r.opacity!=='number'||!Number.isFinite(r.opacity)||r.opacity<0||r.opacity>1))throw Error('参考图片透明度需要在0%到100%之间');
  if (typeof r !== 'object' || !/^[a-zA-Z0-9_-]{1,80}$/.test(r.id) || typeof r.name !== 'string' || r.name.length>256 || typeof r.visible !== 'boolean')
    throw new Error('参考物身份或显示状态无效');
  if ([r.x,r.y,r.z].some(v=>!Number.isFinite(v)||Math.abs(v)>2048) || !Number.isFinite(r.height) || r.height<=0 || r.height>256)
    throw new Error('参考物位置或世界高度无效');
  if ([r.contentTop,r.contentBottom,r.footX,r.footY].some(v=>!Number.isFinite(v)||v<0||v>1) || r.contentBottom-r.contentTop<0.001)
    throw new Error('参考物有效范围或脚底锚点无效');
  const size=pngDimensions(r.dataUrl);
  if (r.pixelWidth!==size.width || r.pixelHeight!==size.height) throw new Error('参考物像素尺寸与PNG不符');
  }
}
export function createReference(input: Pick<PngReference,'id'|'name'|'dataUrl'|'pixelWidth'|'pixelHeight'>): PngReference {
  const reference: PngReference = {...input,x:0,y:0,z:0,height:1.7,visible:true,contentTop:0,contentBottom:1,footX:0.5,footY:1};
  validateEditorMetadata({reference}); return reference;
}
/** Keep transparent padding; calibrate the full plane using the effective subject height. */
export function referenceLayout(r: PngReference) {
  const height=r.height/(r.contentBottom-r.contentTop);
  const width=height*r.pixelWidth/r.pixelHeight;
  return {width,height,offsetX:(0.5-r.footX)*width,offsetY:(r.footY-0.5)*height};
}
/** Only for game/model export. Normal saves must keep the original editor metadata. */
export function stripEditorMetadata<T extends object>(source: T): Omit<T,'editor'> {
  const copy:any=structuredClone(source); delete copy.editor; return copy;
}

