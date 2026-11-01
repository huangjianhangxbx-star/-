/** Drawing planes belong to the modeling tool, never to a camera view. */
export class ModelingWorkPlane {
 face=4;
 private levels=[0,0,0,0,0,0];
 constructor(saved?:string|null){
  try{const value=JSON.parse(saved??'null');if(value&&Number.isInteger(value.face)&&value.face>=0&&value.face<6&&Array.isArray(value.levels)&&value.levels.length===6&&value.levels.every((n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&Math.abs(n)<=8192)){this.face=value.face;this.levels=[...value.levels];}}catch{}
 }
 get axis(){return Math.floor(this.face/2);}
 get sign(){return this.face%2?-1:1;}
 get level(){return this.levels[this.face];}
 choose(face:number){if(!Number.isInteger(face)||face<0||face>5)throw Error('请选择有效的绘制朝向');this.face=face;}
 setLevel(level:number){if(!Number.isInteger(level)||Math.abs(level)>8192)throw Error('工作层必须是 -8192 至 8192 的整数');this.levels[this.face]=level;}
 snapshot(){return {face:this.face,levels:[...this.levels]};}
}
export const modelingDirections=[{face:4,label:'上 · +Z'},{face:5,label:'下 · −Z'},{face:0,label:'右 · +X'},{face:1,label:'左 · −X'},{face:2,label:'后 · +Y'},{face:3,label:'前 · −Y'}] as const;
